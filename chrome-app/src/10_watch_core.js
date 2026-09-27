/* ==== watch_core ==== */
"use strict";
/* ============================ COMPETITOR WATCH: roster, ledger, library links, API bridge, importers, analytics ============================ */
/* The ledger lives in this browser (localStorage) and travels as JSON or CSV. Nothing here calls a platform on its own: the Meta Ad
   Library API bridge builds the request and runs it only when the page is opened outside the Claude viewer (whose network rules block
   it) and a token is supplied; otherwise the request URL opens in a new tab and the JSON answer is pasted back into the importer. */
const WATCH = (() => {
  const KEY = 'tda.watch.v1'; const ROSTER_DATE = DATA.comp_generated || '2026-08-18';
  const CK = SLM.compKey;
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  /* ---------- companies (locations grouped) ---------- */
  const COMPANIES = (() => {
    const m = new Map();
    COMP.forEach((l, i) => {
      const k = CK(l); if (!m.has(k)) m.set(k, { key: k, name: l.name.replace(/\s*\((Frisco|Dallas|Irving|Fort Worth|Waxahachie|Plano|Arlington|Denton|McKinney)\)\s*$/i, ''), domain: l.domain || '', tier: l.tier, locs: [], cities: [], reviews: 0, rating: null, dr: l.dr, org_traffic: l.org_traffic, org_kw: l.org_kw, paid_kw: l.paid_kw || 0, services: [], brands: [], intel: l.intel || null, founded: l.founded, phone: l.phone, notes: l.notes, scope: l.scope, lat: l.lat, lon: l.lon });
      const c = m.get(k); c.locs.push(i); if (!c.cities.includes(l.city)) c.cities.push(l.city); c.reviews += l.reviews || 0; if (l.rating != null) c.rating = c.rating == null ? l.rating : Math.round(((c.rating + l.rating) / 2) * 10) / 10;
      (l.services || []).forEach(s => { if (!c.services.includes(s)) c.services.push(s); }); (l.brands || []).forEach(b => { if (!c.brands.includes(b)) c.brands.push(b); }); if (!c.intel && l.intel) c.intel = l.intel; if ((l.paid_kw || 0) > c.paid_kw) c.paid_kw = l.paid_kw; if (l.tier === 'top40' && c.tier === 'roster') c.tier = 'top40';
    });
    return [...m.values()].sort((a, b) => b.reviews - a.reviews);
  })();
  const CI = {}; COMPANIES.forEach(c => CI[c.key] = c);
  const isBench = c => c.tier === 'integrity';
  /* ---------- taxonomies ---------- */
  const KINDS = { ad: 'Ad', offer: 'Offer or promotion', signal: 'Signal', event: 'Event', reviews: 'Review snapshot' };
  const PLATFORMS = { meta: 'Meta (Facebook, Instagram)', google: 'Google Search', lsa: 'Local Services Ads', youtube: 'YouTube', microsoft: 'Microsoft Advertising', nextdoor: 'Nextdoor', yelp: 'Yelp', site: 'Website', mail: 'Direct mail', tv: 'TV or streaming', radio: 'Radio or podcast', ooh: 'Billboard or vehicle', other: 'Other' };
  const FORMATS = ['image', 'video', 'carousel', 'text', 'lead form', 'story or reel', 'display', 'other'];
  const OFFERS = { price: 'Stated price', discount: 'Dollars or percent off', coupon: 'Coupon code', financing: 'Financing terms', free: 'Free item or visit', bundle: 'Bundle or package', membership: 'Membership or plan', rebate: 'Rebate or credit', warranty: 'Warranty or guarantee', none: 'No offer' };
  const HOOKS = ['heat wave', 'cold snap', 'R22', 'A2L transition', 'tax credit', 'rebate', 'hail or storm', 'tune up season', 'new homeowner', 'financing', 'reviews and trust', 'speed', 'price transparency', 'brand', 'Spanish', 'holiday', 'recruiting', 'other'];
  const LINE_IDS = SLM.LINES.map(l => l.id);
  /* ---------- state ---------- */
  let S;
  function blank() { return { obs: [], meta: {}, settings: { keepToken: false, token: '', apiVersion: 'v21.0' }, seeded: false, created: today() }; }
  function load() { const s = store.get(KEY, null); if (s && Array.isArray(s.obs)) { s.meta = s.meta || {}; s.settings = Object.assign({ keepToken: false, token: '', apiVersion: 'v21.0' }, s.settings || {}); return s; } const b = blank(); b.obs = seed(); b.seeded = true; return b; }
  function save() { try { const s = JSON.parse(JSON.stringify(S)); if (!s.settings.keepToken) s.settings.token = ''; store.set(KEY, s); } catch (e) { } BUS.emit('watch'); }
  /* ---------- seed observations from the heatmap's website intel (August 2026) ---------- */
  const inferLine = t => { t = String(t || '').toLowerCase(); if (/tune|maint|member|club|plan/.test(t)) return 'maint'; if (/duct/.test(t)) return 'duct'; if (/air quality|purif|iaq|filter/.test(t)) return 'iaq'; if (/furnace|heat(ing)? /.test(t)) return 'heat'; if (/mini split|ductless/.test(t)) return 'ductless'; if (/financ|new system|replace|install|estimate|free quote/.test(t)) return 'replace'; if (/repair|diagnos|service call/.test(t)) return 'repair'; return ''; };
  const inferOffer = t => { t = String(t || '').toLowerCase(); if (/financ|apr|months|0%|no interest|payment/.test(t)) return 'financing'; if (/code|coupon/.test(t)) return 'coupon'; if (/\bfree\b/.test(t)) return 'free'; if (/member|club|plan/.test(t)) return 'membership'; if (/rebate|credit/.test(t)) return 'rebate'; if (/off\b|%|discount|save/.test(t)) return 'discount'; if (/\$\s?\d/.test(t)) return 'price'; return 'none'; };
  const priceIn = t => { const m = String(t || '').match(/\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/); return m ? +m[1].replace(/,/g, '') : null; };
  function seed() {
    const out = [];
    COMPANIES.forEach(c => {
      if (isBench(c)) return; const I = c.intel; const base = { comp: c.key, compName: c.name, src: 'seed', first: ROSTER_DATE, last: ROSTER_DATE, status: 'unknown', lang: 'en', geo: '', zips: [] };
      if ((c.paid_kw || 0) > 0) out.push(Object.assign({}, base, { id: uid(), kind: 'signal', platform: 'google', status: 'active', format: 'text', line: '', text: `${N(c.paid_kw)} paid search keywords detected (Ahrefs, ${ROSTER_DATE})`, hook: 'other', offer: { type: 'none', text: '', price: null, fin: '' } }));
      if (!I) return;
      const clean = v => v && v !== '-' && !/^none/i.test(v) ? String(v) : '';
      if (clean(I.promos)) clean(I.promos).split(/;\s*/).forEach(pr => out.push(Object.assign({}, base, { id: uid(), kind: 'offer', platform: 'site', status: /stale|expired/i.test(pr) ? 'inactive' : 'unknown', format: 'text', line: inferLine(pr), text: pr, hook: /tune/i.test(pr) ? 'tune up season' : 'price transparency', offer: { type: inferOffer(pr), text: pr, price: priceIn(pr), fin: '' } })));
      if (clean(I.financing)) out.push(Object.assign({}, base, { id: uid(), kind: 'offer', platform: 'site', status: 'unknown', format: 'text', line: 'replace', text: 'Financing: ' + clean(I.financing), hook: 'financing', offer: { type: 'financing', text: clean(I.financing), price: null, fin: clean(I.financing) } }));
      if (clean(I.membership)) out.push(Object.assign({}, base, { id: uid(), kind: 'offer', platform: 'site', status: 'unknown', format: 'text', line: 'maint', text: 'Membership: ' + clean(I.membership), hook: 'tune up season', offer: { type: 'membership', text: clean(I.membership), price: priceIn(clean(I.membership)), fin: '' } }));
      if (clean(I.ad_signals) && !/^(minimal|single line|single number|one number)$/i.test(clean(I.ad_signals))) { const a = clean(I.ad_signals); out.push(Object.assign({}, base, { id: uid(), kind: 'signal', platform: /lsa|google guaranteed/i.test(a) ? 'lsa' : /pixel|fb/i.test(a) ? 'meta' : 'site', status: /lsa|google guaranteed/i.test(a) ? 'active' : 'unknown', format: 'other', line: '', text: 'Ad signals: ' + a, hook: 'other', offer: { type: 'none', text: '', price: null, fin: '' } })); }
    });
    return out.map(o => { o.lint = lintObs(o); return o; });
  }
  S = load();
  /* ---------- library deep links ---------- */
  const enc = encodeURIComponent;
  const LINKS = {
    metaKw: q => `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${enc(q)}&search_type=keyword_unordered&media_type=all`,
    metaKwAll: q => `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&q=${enc(q)}&search_type=keyword_unordered&media_type=all`,
    metaPage: id => `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&view_all_page_id=${enc(id)}&search_type=page&media_type=all`,
    metaLib: id => `https://www.facebook.com/ads/library/?id=${enc(id)}`,
    googleDomain: d => `https://adstransparency.google.com/?region=US&domain=${enc(String(d).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))}`,
    googleAdv: id => `https://adstransparency.google.com/advertiser/${enc(id)}?region=US`,
    googleCreative: (adv, cr) => `https://adstransparency.google.com/advertiser/${enc(adv)}/creative/${enc(cr)}?region=US`,
    gSearch: (name, city) => `https://www.google.com/search?q=${enc(name + ' ' + (city || 'Dallas') + ' hvac')}`,
    gMaps: (name, addr) => `https://www.google.com/maps/search/?api=1&query=${enc(name + ' ' + (addr || ''))}`,
    site: d => d ? (/^https?:/.test(d) ? d : 'https://www.' + d) : '',
  };
  /* ---------- Meta Ad Library API bridge ---------- */
  const API_FIELDS = { base: ['id', 'page_id', 'page_name', 'ad_creation_time', 'ad_delivery_start_time', 'ad_delivery_stop_time', 'ad_creative_bodies', 'ad_creative_link_titles', 'ad_creative_link_descriptions', 'ad_creative_link_captions', 'ad_snapshot_url', 'publisher_platforms', 'languages'], political: ['bylines', 'currency', 'spend', 'impressions', 'demographic_distribution', 'delivery_by_region', 'estimated_audience_size'], eu: ['target_locations', 'target_ages', 'target_gender', 'eu_total_reach', 'beneficiary_payers'] };
  function metaApiUrl(o) {
    o = o || {}; const v = o.version || S.settings.apiVersion || 'v21.0'; const p = new URLSearchParams();
    if (o.token) p.set('access_token', o.token);
    p.set('ad_reached_countries', JSON.stringify(o.countries && o.countries.length ? o.countries : ['US']));
    p.set('ad_type', o.adType || 'ALL'); p.set('ad_active_status', o.status || 'ACTIVE');
    if (o.terms) p.set('search_terms', o.terms); if (o.pageIds && o.pageIds.length) p.set('search_page_ids', JSON.stringify(o.pageIds));
    if (o.terms) p.set('search_type', o.searchType || 'KEYWORD_UNORDERED');
    if (o.since) p.set('ad_delivery_date_min', o.since);
    const f = API_FIELDS.base.concat(o.adType === 'POLITICAL_AND_ISSUE_ADS' ? API_FIELDS.political : []).concat(o.eu ? API_FIELDS.eu : []); p.set('fields', f.join(',')); p.set('limit', String(o.limit || 100));
    return `https://graph.facebook.com/${v}/ads_archive?${p.toString()}`;
  }
  const canFetch = () => !inViewer();
  async function metaApiRun(o) {
    const url = metaApiUrl(o); const out = []; let next = url, pages = 0;
    while (next && pages < (o.maxPages || 5)) { const r = await fetch(next, { mode: 'cors' }); const j = await r.json(); if (j.error) throw new Error(j.error.message || 'Graph API error'); (j.data || []).forEach(x => out.push(x)); next = j.paging && j.paging.next; pages++; }
    return out;
  }
  /* ---------- matching and importers ---------- */
  const norm = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(inc|llc|co|company|the|of|dfw|dallas|fort worth|texas|tx|heating|cooling|air conditioning|ac|a c|hvac|plumbing|electrical|services?|and)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const domOf = u => { const m = String(u || '').toLowerCase().match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/); return m ? m[1] : ''; };
  function matchCompany(name, domainOrUrl) {
    const d = domOf(domainOrUrl); if (d) { const hit = COMPANIES.find(c => c.domain && (c.domain === d || d.endsWith('.' + c.domain))); if (hit) return hit; }
    const n = norm(name); if (!n) return null; const exact = COMPANIES.find(c => norm(c.name) === n); if (exact) return exact;
    const toks = n.split(' ').filter(t => t.length > 2); let best = null, bs = 0; COMPANIES.forEach(c => { const cn = norm(c.name); const hits = toks.filter(t => cn.includes(t)).length; const sc = hits / Math.max(1, toks.length); if (sc > bs && hits >= 1 && sc >= 0.5) { bs = sc; best = c; } });
    return best;
  }
  function fromMetaApi(items, fallbackKey) {
    return (items || []).map(x => { const caption = (x.ad_creative_link_captions || [])[0] || ''; const c = matchCompany(x.page_name, caption); const body = (x.ad_creative_bodies || [])[0] || ''; const title = (x.ad_creative_link_titles || [])[0] || ''; const text = [title, body].filter(Boolean).join(' · ');
      return { id: uid(), comp: c ? c.key : '', compName: c ? c.name : (x.page_name || 'Unmatched page'), kind: 'ad', platform: 'meta', status: x.ad_delivery_stop_time ? 'inactive' : 'active', first: (x.ad_delivery_start_time || x.ad_creation_time || '').slice(0, 10), last: (x.ad_delivery_stop_time || today()).slice(0, 10), format: 'other', line: inferLine(text), text, hook: inferHook(text), cta: '', url: caption, geo: '', zips: [], lang: (x.languages || [])[0] === 'es' ? 'es' : 'en', ids: { lib: x.id || '', page: x.page_id || '', adv: '', cr: '' }, snapshot: x.ad_snapshot_url || '', notes: (x.publisher_platforms || []).join(', '), src: 'meta-api', offer: { type: inferOffer(text), text: '', price: priceIn(text), fin: /financ|apr|month/i.test(text) ? (text.match(/[^.]*(financ|apr|month)[^.]*/i) || [''])[0].trim() : '' } }; });
  }
  const inferHook = t => { t = String(t || '').toLowerCase(); if (/heat wave|100|hot|triple digit/.test(t)) return 'heat wave'; if (/freez|cold|winter/.test(t)) return 'cold snap'; if (/r22|r-22|freon/.test(t)) return 'R22'; if (/a2l|r454|r32|refrigerant/.test(t)) return 'A2L transition'; if (/tax credit|25c/.test(t)) return 'tax credit'; if (/rebate/.test(t)) return 'rebate'; if (/hail|storm/.test(t)) return 'hail or storm'; if (/tune|maintenance|inspection/.test(t)) return 'tune up season'; if (/new home|just moved/.test(t)) return 'new homeowner'; if (/financ|apr|month|payment/.test(t)) return 'financing'; if (/review|star|trust|rated/.test(t)) return 'reviews and trust'; if (/same day|24\/7|fast|today|now/.test(t)) return 'speed'; if (/upfront|price|\$/.test(t)) return 'price transparency'; if (/trane|lennox|carrier|daikin|goodman|american standard/.test(t)) return 'brand'; if (/hiring|technician|apply|careers/.test(t)) return 'recruiting'; return 'other'; };
  function fromUrls(text, compKey) {
    const out = []; const meta = {}; String(text || '').split(/\s+/).forEach(u => { let m; if ((m = u.match(/ads\/library\/\?id=(\d+)/))) out.push(blankObs({ comp: compKey, platform: 'meta', kind: 'ad', ids: { lib: m[1] }, snapshot: LINKS.metaLib(m[1]), src: 'import' })); else if ((m = u.match(/view_all_page_id=(\d+)/))) meta.pageId = m[1]; else if ((m = u.match(/adstransparency\.google\.com\/advertiser\/(AR\d+)\/creative\/(CR\d+)/))) out.push(blankObs({ comp: compKey, platform: 'google', kind: 'ad', ids: { adv: m[1], cr: m[2] }, snapshot: u, src: 'import' })); else if ((m = u.match(/adstransparency\.google\.com\/advertiser\/(AR\d+)/))) meta.advId = m[1]; });
    return { obs: out, meta };
  }
  const CSV_H = ['id', 'competitor', 'competitor_key', 'kind', 'platform', 'status', 'first_seen', 'last_seen', 'format', 'service_line', 'offer_type', 'offer_text', 'price_usd', 'financing_terms', 'hook', 'cta', 'landing_url', 'geo', 'zips', 'language', 'meta_library_id', 'meta_page_id', 'google_advertiser_id', 'google_creative_id', 'snapshot_url', 'text', 'notes', 'source', 'review_count', 'review_rating', 'lint'];
  function toRow(o) { return [o.id, o.compName, o.comp, o.kind, o.platform, o.status, o.first, o.last, o.format, o.line, o.offer && o.offer.type, o.offer && o.offer.text, o.offer && o.offer.price, o.offer && o.offer.fin, o.hook, o.cta, o.url, o.geo, (o.zips || []).join(' '), o.lang, o.ids && o.ids.lib, o.ids && o.ids.page, o.ids && o.ids.adv, o.ids && o.ids.cr, o.snapshot, o.text, o.notes, o.src, o.reviews && o.reviews.count, o.reviews && o.reviews.rating, (o.lint || []).join(' ')]; }
  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false; const s = String(text || '').replace(/\r/g, '');
    for (let i = 0; i < s.length; i++) { const ch = s[i]; if (q) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch; }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.length > 1 && !(r.length === 1 && !r[0]) && !String(r[0]).startsWith('#'));
  }
  function fromCSV(text) {
    const rows = parseCSV(text); if (!rows.length) return []; const H = rows[0].map(h => String(h).trim().toLowerCase()); const ix = k => H.indexOf(k); const g = (r, k) => { const i = ix(k); return i >= 0 ? String(r[i] || '').trim() : ''; };
    return rows.slice(1).map(r => { const c = CI[g(r, 'competitor_key')] || matchCompany(g(r, 'competitor'), g(r, 'landing_url')); return blankObs({ comp: c ? c.key : '', compName: c ? c.name : g(r, 'competitor'), kind: KINDS[g(r, 'kind')] ? g(r, 'kind') : 'ad', platform: PLATFORMS[g(r, 'platform')] ? g(r, 'platform') : 'other', status: g(r, 'status') || 'unknown', first: g(r, 'first_seen'), last: g(r, 'last_seen'), format: g(r, 'format') || 'other', line: LINE_IDS.includes(g(r, 'service_line')) ? g(r, 'service_line') : inferLine(g(r, 'text') + ' ' + g(r, 'offer_text')), offer: { type: OFFERS[g(r, 'offer_type')] ? g(r, 'offer_type') : inferOffer(g(r, 'offer_text')), text: g(r, 'offer_text'), price: g(r, 'price_usd') ? +g(r, 'price_usd') : priceIn(g(r, 'offer_text')), fin: g(r, 'financing_terms') }, hook: HOOKS.includes(g(r, 'hook')) ? g(r, 'hook') : inferHook(g(r, 'text')), cta: g(r, 'cta'), url: g(r, 'landing_url'), geo: g(r, 'geo'), zips: g(r, 'zips').split(/[\s,;]+/).filter(z => ZI[z]), lang: g(r, 'language') === 'es' ? 'es' : 'en', ids: { lib: g(r, 'meta_library_id'), page: g(r, 'meta_page_id'), adv: g(r, 'google_advertiser_id'), cr: g(r, 'google_creative_id') }, snapshot: g(r, 'snapshot_url'), text: g(r, 'text'), notes: g(r, 'notes'), src: 'import', reviews: g(r, 'review_count') ? { count: +g(r, 'review_count'), rating: +g(r, 'review_rating') || null } : null }); });
  }
  function blankObs(o) { const c = o && o.comp ? CI[o.comp] : null; return Object.assign({ id: uid(), comp: c ? c.key : '', compName: c ? c.name : '', kind: 'ad', platform: 'meta', status: 'active', first: today(), last: today(), format: 'image', line: '', offer: { type: 'none', text: '', price: null, fin: '' }, hook: 'other', cta: '', url: '', geo: '', zips: [], lang: 'en', ids: { lib: '', page: '', adv: '', cr: '' }, snapshot: '', text: '', notes: '', src: 'manual', reviews: null, lint: [] }, o || {}); }
  function importText(text, compKey) {
    const t = String(text || '').trim(); if (!t) return { obs: [], meta: {}, note: 'Nothing to import' };
    if (t[0] === '{' || t[0] === '[') { let j; try { j = JSON.parse(t); } catch (e) { return { obs: [], meta: {}, note: 'That is not valid JSON' }; } if (j && j.obs && Array.isArray(j.obs)) return { obs: j.obs.map(o => blankObs(Object.assign({}, o, { src: o.src === 'seed' ? 'seed' : 'import' }))), meta: j.meta || {}, note: `${j.obs.length} ledger entries from an atlas export` }; const items = Array.isArray(j) ? j : (j.data || []); return { obs: fromMetaApi(items, compKey), meta: {}, note: `${items.length} ads from a Meta Ad Library API response` }; }
    if (/adstransparency\.google\.com|facebook\.com\/ads\/library/.test(t)) { const r = fromUrls(t, compKey); return { obs: r.obs, meta: r.meta, note: `${r.obs.length} ad links${r.meta.pageId ? ', a Meta Page ID' : ''}${r.meta.advId ? ', a Google advertiser ID' : ''}` }; }
    if (/,/.test(t.split('\n')[0])) { const o = fromCSV(t); return { obs: o, meta: {}, note: `${o.length} rows from CSV` }; }
    return { obs: [], meta: {}, note: 'Paste a Meta Ad Library API JSON response, ad library links, or a ledger CSV' };
  }
  /* ---------- lint (Satchel rules on the copy) ---------- */
  function lintObs(o) { const txt = [o.text, o.offer && o.offer.text, o.offer && o.offer.fin, o.cta].filter(Boolean).join(' '); if (!txt) return []; return satchelLint(txt, { platform: o.platform, noHouse: true }).map(x => x.rule.id); }
  /* ---------- CRUD ---------- */
  function add(o) { const ob = blankObs(o); ob.lint = lintObs(ob); S.obs.push(ob); save(); return ob; }
  function update(id, patch) { const o = S.obs.find(x => x.id === id); if (!o) return; Object.assign(o, patch); if (o.comp && CI[o.comp]) o.compName = CI[o.comp].name; o.lint = lintObs(o); save(); }
  function remove(id) { S.obs = S.obs.filter(x => x.id !== id); save(); }
  function addMany(list, metaPatchKey, meta) { list.forEach(o => { const ob = blankObs(o); ob.lint = lintObs(ob); S.obs.push(ob); }); if (metaPatchKey && meta && (meta.pageId || meta.advId)) setMeta(metaPatchKey, { pageId: meta.pageId, advId: meta.advId }); save(); }
  function setMeta(key, patch) { S.meta[key] = Object.assign(S.meta[key] || {}, patch); Object.keys(S.meta[key]).forEach(k => { if (S.meta[key][k] == null || S.meta[key][k] === '') delete S.meta[key][k]; }); save(); }
  function meta(key) { return S.meta[key] || {}; }
  function clearSeeds() { S.obs = S.obs.filter(o => o.src !== 'seed'); S.seeded = false; save(); }
  function reseed() { S.obs = S.obs.filter(o => o.src !== 'seed').concat(seed()); S.seeded = true; save(); }
  function replaceAll(obj) { if (obj && Array.isArray(obj.obs)) { S = Object.assign(blank(), obj); S.obs = S.obs.map(o => blankObs(o)); save(); } }
  function setSettings(p) { Object.assign(S.settings, p); save(); }
  /* ---------- analytics ---------- */
  const daysAgo = d => { const t = Date.parse(d); return isN(t) ? (Date.now() - t) / 864e5 : 9e9; };
  const isLive = o => o.status === 'active' || (o.status === 'unknown' && daysAgo(o.last) <= 60);
  function activity() { const out = {}; S.obs.forEach(o => { if (o.src === 'seed' || o.kind !== 'ad' || !o.comp || !isLive(o) || daysAgo(o.last) > 120) return; const a = out[o.comp] = out[o.comp] || { _all: 0 }; a._all++; if (o.line) a[o.line] = (a[o.line] || 0) + 1; }); return out; }
  function forCompany(key) { return S.obs.filter(o => o.comp === key).sort((a, b) => String(b.last).localeCompare(String(a.last))); }
  function score(c) { const obs = forCompany(c.key); const live = obs.filter(o => o.kind === 'ad' && isLive(o)); const plats = new Set(live.map(o => o.platform)); return (c.paid_kw > 0 ? 25 : 0) + (SLM.adSignal(COMP[c.locs[0]]) ? 10 : 0) + Math.min(40, live.length * 6) + plats.size * 5 + (obs.some(o => o.kind === 'offer' && o.offer && o.offer.type === 'financing') ? 8 : 0) + (obs.some(o => o.kind === 'offer' && o.offer && o.offer.type === 'membership') ? 6 : 0) + Math.min(6, Math.log10((c.reviews || 0) + 1) * 2); }
  function stats() {
    const obs = S.obs; const ads = obs.filter(o => o.kind === 'ad'); const live = ads.filter(isLive); const byComp = {}; live.forEach(o => byComp[o.comp || o.compName] = (byComp[o.comp || o.compName] || 0) + 1);
    const byPlat = {}; live.forEach(o => byPlat[o.platform] = (byPlat[o.platform] || 0) + 1);
    const offers = obs.filter(o => o.kind === 'offer' || (o.offer && o.offer.type && o.offer.type !== 'none')); const byOffer = {}; offers.forEach(o => byOffer[o.offer.type] = (byOffer[o.offer.type] || 0) + 1);
    const byHook = {}; obs.forEach(o => { if (o.hook) byHook[o.hook] = (byHook[o.hook] || 0) + 1; });
    const byLine = {}; obs.forEach(o => { if (o.line) byLine[o.line] = (byLine[o.line] || 0) + 1; });
    const prices = offers.filter(o => isN(o.offer.price)).map(o => ({ comp: o.compName, line: o.line || inferLine(o.text), type: o.offer.type, price: +o.offer.price, text: o.offer.text || o.text, last: o.last }));
    const fin = offers.filter(o => o.offer.type === 'financing').map(o => ({ comp: o.compName, text: o.offer.fin || o.offer.text || o.text, last: o.last, lint: o.lint || [] }));
    const companies = new Set(obs.filter(o => o.comp).map(o => o.comp)); const lastObs = obs.filter(o => o.src !== 'seed').map(o => o.last).sort().pop() || null;
    const checked = Object.values(S.meta).map(m => m.lastChecked).filter(Boolean).sort(); const lastSweep = checked.pop() || null;
    return { n: obs.length, ads: ads.length, live: live.length, byComp, byPlat, byOffer, byHook, byLine, prices, fin, companies: companies.size, lastObs, lastSweep, seeded: obs.filter(o => o.src === 'seed').length, lints: obs.filter(o => (o.lint || []).length).length };
  }
  function weekly(weeks) { weeks = weeks || 26; const now = Date.now(); const out = Array.from({ length: weeks }, (_, i) => ({ w: i, t: now - (weeks - 1 - i) * 7 * 864e5, meta: 0, google: 0, other: 0 })); S.obs.forEach(o => { if (o.kind !== 'ad') return; const t = Date.parse(o.first || o.last); if (!isN(t)) return; const i = Math.floor((t - out[0].t) / (7 * 864e5)); if (i < 0 || i >= weeks) return; const k = o.platform === 'meta' ? 'meta' : (o.platform === 'google' || o.platform === 'lsa' || o.platform === 'youtube') ? 'google' : 'other'; out[i][k]++; }); return out; }
  function zipCounts() { const m = {}; S.obs.forEach(o => { if (!isLive(o) && o.kind === 'ad') return; (o.zips || []).forEach(z => m[z] = (m[z] || 0) + 1); }); return m; }
  function digest() {
    const st = stats(); const out = []; const compsLive = Object.keys(st.byComp).length; const tracked = COMPANIES.filter(c => !isBench(c)).length;
    if (st.live) out.push(`${N(compsLive)} of ${N(tracked)} tracked companies have ${N(st.live)} ads on record as live${st.byPlat.meta ? `, ${N(st.byPlat.meta)} on Meta` : ''}${st.byPlat.google ? `, ${N(st.byPlat.google)} on Google Search` : ''}${st.byPlat.lsa ? `, ${N(st.byPlat.lsa)} in Local Services` : ''}.`); else out.push('No competitor ad has been logged as live yet. The seeded entries are website intel from August 2026; open the library links in the sweep planner and log what you see.');
    const paid = COMPANIES.filter(c => !isBench(c) && c.paid_kw > 0).length; out.push(`${N(paid)} companies showed paid search keywords in Ahrefs on ${ROSTER_DATE}; Local Services Ads are invisible to that measure.`);
    const tune = st.prices.filter(p => p.line === 'maint' && p.price > 0 && p.price < 400); if (tune.length) { const med = median(tune.map(p => p.price)); out.push(`${N(tune.length)} maintenance or tune up offers carry a price; the median is ${M$(med)} and the cheapest is ${M$(Math.min(...tune.map(p => p.price)))} (${esc(tune.sort((a, b) => a.price - b.price)[0].comp)}).`); }
    if (st.fin.length) out.push(`${N(st.fin.length)} companies advertise financing; ${N(st.fin.filter(f => f.lint.includes('REGZ1')).length)} state a trigger term (months, payment or rate) without the APR and terms that Regulation Z requires beside it.`);
    const mem = st.byOffer.membership || 0; if (mem) { const mp = st.prices.filter(p => p.type === 'membership' && p.price > 0 && p.price < 100).map(p => p.price); out.push(`${N(mem)} companies sell a membership or maintenance plan${mp.length ? `, the cheapest from ${M$(Math.min(...mp))} a month` : ''}.`); }
    const hooks = Object.entries(st.byHook).filter(([k]) => k !== 'other').sort((a, b) => b[1] - a[1]).slice(0, 3); if (hooks.length) out.push(`The most common hooks on record: ${hooks.map(([k, v]) => `${k} (${v})`).join(', ')}.`);
    const lines = Object.entries(st.byLine).sort((a, b) => b[1] - a[1]).slice(0, 3); if (lines.length) out.push(`Lines most often advertised or promoted: ${lines.map(([k, v]) => `${SLM.lineName(k)} (${v})`).join(', ')}.`);
    if (st.lints) out.push(`${N(st.lints)} entries trip a Satchel rule (lapsed tax credit, Regulation Z trigger terms, superiority claims, R22 misstatements). Each is intelligence first and a report only when the evidentiary bar is met (module 10).`);
    return out;
  }
  /* ---------- exports ---------- */
  function csv() { return toCSV(CSV_H, S.obs.map(toRow), `Competitor Watch ledger, DFW Thermal Debt Atlas, exported ${today()}. Seeded rows are website intel from the ${ROSTER_DATE} roster; the rest are observations logged by the analyst or imported from the Meta Ad Library API.`); }
  function json() { const s = JSON.parse(JSON.stringify(S)); s.settings.token = ''; return JSON.stringify(Object.assign({ exported: today(), atlas: 'DFW Thermal Debt Atlas, module 13' }, s), null, 1); }
  function sweepRows(scopeKeys) { return (scopeKeys || COMPANIES.filter(c => !isBench(c) && (c.tier === 'top40' || forCompany(c.key).some(o => o.src !== 'seed'))).map(c => c.key)).map(k => { const c = CI[k], m = meta(k); return [c.name, c.domain, c.cities.join('; '), m.lastChecked || '', m.lastChecked ? Math.round(daysAgo(m.lastChecked)) : '', LINKS.metaKw(c.name), m.pageId ? LINKS.metaPage(m.pageId) : '', c.domain ? LINKS.googleDomain(c.domain) : '', m.advId ? LINKS.googleAdv(m.advId) : '', LINKS.gSearch(c.name, c.cities[0]), forCompany(k).filter(o => o.kind === 'ad' && isLive(o)).length]; }); }
  return { COMPANIES, CI, KINDS, PLATFORMS, FORMATS, OFFERS, HOOKS, LINKS, API_FIELDS, ROSTER_DATE, isBench, get S() { return S; }, get obs() { return S.obs; }, settings: () => S.settings, setSettings, metaApiUrl, metaApiRun, canFetch, matchCompany, importText, blankObs, add, update, remove, addMany, setMeta, meta, clearSeeds, reseed, replaceAll, activity, forCompany, score, stats, weekly, zipCounts, digest, csv, json, sweepRows, isLive, daysAgo, inferLine, inferOffer, inferHook, lintObs, today };
})();
SLM.setActivity(() => WATCH.activity());
