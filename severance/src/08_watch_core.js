/* SEVERANCE competitor watch core (WATCH): the roster the firm builds, the observation ledger, research links, scores, importers,
   exports and the Meta Ad Library API bridge. Port of the Thermal Atlas watch core (chrome-app/src/10_watch_core.js), translated to a
   Texas family law practice. Severance ships no named competitor data (the Census counts law offices by county and ZIP, not firms), so
   the roster starts empty and holds only what the firm enters or imports.
   Nothing here calls a platform on its own. The library links open public search pages; the Meta Ad Library API bridge builds the
   ads_archive request and runs it only when the user clicks Run with a token, outside the hosted viewer (whose network rules block it).
     WATCH.list({archived})            competitors (active by default)
     WATCH.add({name, domain, counties, lines, tier, offices, lawyers, notes, meta_page_id, google_advertiser_id, aliases})
     WATCH.update(key, patch), WATCH.archive(key, on), WATCH.remove(key)
     WATCH.observe(key, {kind:'ad'|'offer'|'review'|'page'|'rank'|'signal'|'event'|'note', ...})   one dated observation
     WATCH.score(c) 0 to 100 (recency weighted activity), WATCH.scoreDetail(c), WATCH.reviews(key), WATCH.coverage(c)
     WATCH.compare(keys) side by side with the firm, WATCH.claims() LINT on every logged competitor ad
     WATCH.LINKS research link builders, WATCH.importText(text), WATCH.csv(), WATCH.json(), WATCH.rosterCSV()
   Storage: store key 'sev.watch'. Emits BUS 'watch' on every change. */
'use strict';
const WATCH_HOST_ORIGINS = ['https://graph.facebook.com/*'];   // the Meta Ad Library API bridge (a click with the user's own token)
const WATCH = (() => {
  const KEY = 'sev.watch'; const FIRM_KEY = '_firm'; const HALF_LIFE = 45; const SKIP_LINT = new Set(['house', 'r702a', 'ph', 'meta_note', 'r706', 'arc_filing']);   // the firm's own obligations, not claims in the copy
  let NOW = null;   // test clock: WATCH.setClock('2026-10-01')
  const nowMs = () => NOW ? Date.parse(NOW + 'T12:00:00Z') : Date.now();
  const today = () => NOW || todayISO();
  const LINE_KEYS = ['div_k', 'div_nk', 'sapcr', 'mod', 'enf', 'po', 'ivd', 'adopt', 'cps', 'prenup', 'high', 'mil', 'gray'];   // LINE_META loads after this file
  const LM = () => (typeof LINE_META !== 'undefined' ? LINE_META : {});
  const isLine = k => !!k && (typeof LINE_META !== 'undefined' ? !!LINE_META[k] : LINE_KEYS.includes(k));
  const lineName = k => (LM()[k] || {}).name || k || '';
  const lineShort = k => (LM()[k] || {}).short || k || '';
  const firmName = () => (typeof FIRM !== 'undefined' && FIRM.name()) || 'Your firm';
  /* ---------- taxonomies ---------- */
  const TIERS = { direct: 'Direct competitor', adjacent: 'Adjacent practice', referral: 'Referral partner', legalaid: 'Legal aid or nonprofit' };
  const KINDS = { ad: 'Ad', offer: 'Fee or offer', review: 'Review snapshot', page: 'Website page or claim', rank: 'Ranking check', signal: 'Signal', event: 'Event', note: 'Note' };
  const PLATFORMS = { meta: 'Meta (Facebook, Instagram)', google: 'Google Search ads', lsa: 'Local Services Ads', gbp: 'Google Business Profile', organic: 'Google organic results', youtube: 'YouTube', microsoft: 'Microsoft Advertising', tiktok: 'TikTok', linkedin: 'LinkedIn', directory: 'Legal directory (Avvo, Justia, FindLaw, Super Lawyers)', yelp: 'Yelp', nextdoor: 'Nextdoor', site: 'Website', mail: 'Direct mail', tv: 'TV or streaming', radio: 'Radio or podcast', ooh: 'Billboard or transit', other: 'Other' };
  const PLAT_SHORT = { meta: 'Meta', google: 'Google', lsa: 'LSA', gbp: 'GBP', organic: 'Organic', youtube: 'YouTube', microsoft: 'Microsoft', tiktok: 'TikTok', linkedin: 'LinkedIn', directory: 'Directory', yelp: 'Yelp', nextdoor: 'Nextdoor', site: 'Site', mail: 'Mail', tv: 'TV', radio: 'Radio', ooh: 'Billboard', other: 'Other' };
  const FORMATS = ['image', 'video', 'carousel', 'text', 'call only', 'lead form', 'story or reel', 'display', 'other'];
  const STATUSES = ['active', 'inactive', 'unknown'];
  const OFFERS = { flat: 'Flat fee stated', price: 'Fee or price stated', consult_free: 'Free consultation', consult_fee: 'Consultation fee stated', payplan: 'Payment plan or financing', retainer: 'Retainer stated', discount: 'Discount', contingency: 'Contingent fee language', guarantee: 'Guarantee or promise', fast: 'Same day or after hours', virtual: 'Virtual consultation', spanish: 'Spanish service', none: 'No offer' };
  const HOOKS = ['children first', 'custody', 'protect assets', 'fathers rights', 'mothers', 'speed', 'flat fee', 'free consultation', 'price transparency', 'payment plans', 'experience', 'board certification', 'reviews and trust', 'compassion', 'aggressive', 'Spanish', 'military', 'high asset', 'protective order urgency', 'CPS urgency', 'new year', 'summer possession', 'back to school', 'holidays', 'job loss', 'recruiting', 'other'];
  const RANK_WHERE = { maps: 'Map pack', organic: 'Organic results', lsa: 'Local Services Ads', ads: 'Search ads' };
  /* ---------- small parsers ---------- */
  /* a link is rendered only for http and https: a bare domain becomes https://, anything else (javascript:, data:, file:) is dropped */
  function safeUrl(u) { const t = String(u == null ? '' : u).trim(); if (!t) return ''; let x = t; if (!/^[a-z][a-z0-9+.-]*:/i.test(x)) { if (/^\/\//.test(x)) x = 'https:' + x; else if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?([/?#]\S*)?$/i.test(x)) x = 'https://' + x; else return ''; } try { const v = new URL(x); return (v.protocol === 'http:' || v.protocol === 'https:') && v.hostname ? v.href : ''; } catch (e) { return ''; } }
  /* the CSV formula guard: a cell a spreadsheet would run as a formula (=, +, -, @, tab, carriage return first) gets a leading
     apostrophe in the CSVs people open; the importers take it off again so a ledger or roster CSV round trips unchanged */
  const csvGuard = v => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) ? "'" + v : v;
  const guardRows = rows => rows.map(r => r.map(csvGuard));
  const unguard = v => (typeof v === 'string' && /^'[=+\-@\t\r]/.test(v)) ? v.slice(1) : v;
  const unguardRows = rows => (rows || []).map(r => (r || []).map(unguard));
  const domOf = u => { const m = String(u || '').toLowerCase().trim().match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/); return m ? m[1].replace(/\.$/, '') : ''; };
  const hostOf = d => { const b = domOf(d); return !b ? '' : b.split('.').length > 2 ? b : 'www.' + b; };
  const daysAgo = d => { const t = Date.parse(String(d || '').slice(0, 10) + 'T12:00:00Z'); return isN(t) ? (nowMs() - t) / 864e5 : 9e9; };
  const isLive = o => o.status === 'active' || (o.status === 'unknown' && daysAgo(o.last) <= 60);
  const isLiveAd = o => o.kind === 'ad' && isLive(o);
  const priceIn = t => { const m = String(t || '').match(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?/); return m ? +m[1].replace(/,/g, '') : null; };
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const pad = n => String(n).padStart(2, '0');
  function isoFrom(s) {
    s = String(s || '').trim(); let m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[0];
    if ((m = s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/)) && MON[m[1].toLowerCase().slice(0, 3)]) return `${m[3]}-${pad(MON[m[1].toLowerCase().slice(0, 3)])}-${pad(m[2])}`;
    if ((m = s.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/)) && MON[m[2].toLowerCase().slice(0, 3)]) return `${m[3]}-${pad(MON[m[2].toLowerCase().slice(0, 3)])}-${pad(m[1])}`;
    if ((m = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/))) return `${m[3]}-${pad(m[1])}-${pad(m[2])}`;
    return '';
  }
  /* counties by name or FIPS ('Harris', 'Harris County', '48201'); lines by key, name, short name or a plain word */
  let CNAME = null;
  const cKey = s => String(s || '').toLowerCase().replace(/\s+county$/i, '').replace(/[^a-z]/g, '');
  function countyByName(s) {
    const t = String(s || '').trim(); if (!t) return ''; if (/^48\d{3}$/.test(t)) return CI[t] ? t : '';
    if (!CNAME) { CNAME = {}; CTY.forEach(c => { CNAME[cKey(c.name)] = c.fips; }); }
    return CNAME[cKey(t)] || '';
  }
  function countiesFrom(v) { const arr = Array.isArray(v) ? v : String(v || '').split(/[;,|\n]+|\s+and\s+|\s*\/\s*/); return [...new Set(arr.map(x => countyByName(String(x).trim())).filter(Boolean))]; }
  const countyOfCity = city => { const c = String(city || '').trim().toLowerCase(); if (!c) return ''; const z = ZC.find(x => String(x.city || '').toLowerCase() === c); return z ? z.county : ''; };
  function inferLine(t) {
    t = String(t || '').toLowerCase();
    if (/prenup|premarital|postnup|partition agreement/.test(t)) return 'prenup';
    if (/protective order|family violence|domestic violence|restraining order/.test(t)) return 'po';
    if (/\bcps\b|dfps|child protective|removal|terminat(e|ion) (of )?parental/.test(t)) return 'cps';
    if (/adopt/.test(t)) return 'adopt';
    if (/military|deploy|usfspa|\bscra\b|fort (cavazos|bliss|hood)|jbsa|service ?member/.test(t)) return 'mil';
    if (/high (asset|net worth)|business owner|stock option|complex property|executive divorce/.test(t)) return 'high';
    if (/over 50|after 50|gr[ae]y divorce|qdro|pension|late life/.test(t)) return 'gray';
    if (/modif|change (a |your )?(custody|support|order)|relocat/.test(t)) return 'mod';
    if (/enforce|contempt|back child support|arrear|unpaid (child )?support/.test(t)) return 'enf';
    if (/paternity|attorney general|\biv ?d\b|child support (hearing|case)/.test(t)) return 'ivd';
    if (/divorce/.test(t) && /\b(kids?|child|children|custody|parent)/.test(t)) return 'div_k';
    if (/uncontested|agreed divorce|no kids|without (kids|children)|flat fee divorce|simple divorce/.test(t)) return 'div_nk';
    if (/custody|sapcr|conservator|father'?s'? rights|visitation|possession and access|unmarried parent/.test(t)) return 'sapcr';
    return '';
  }
  function linesFrom(v) {
    const arr = Array.isArray(v) ? v : String(v || '').split(/[;,|\n]+/); const out = new Set(); const L = LM();
    arr.forEach(x => { const t = String(x).trim(); if (!t) return; const lo = t.toLowerCase(); if (isLine(t)) { out.add(t); return; }
      const hit = Object.keys(L).find(k => L[k].name.toLowerCase() === lo || L[k].short.toLowerCase() === lo); if (hit) { out.add(hit); return; }
      if (/^divorces?$|^divorce (law|lawyer|attorney)s?$/.test(lo)) { out.add('div_k'); out.add('div_nk'); return; }
      if (/^gr[ae]y/.test(lo)) { out.add('gray'); return; } if (/^custody|^sapcr/.test(lo)) { out.add('sapcr'); return; } if (/^child support|^support/.test(lo)) { out.add('ivd'); return; }
      const g = inferLine(lo); if (g) out.add(g); });
    return [...out].filter(isLine);
  }
  function inferOffer(t) {
    t = String(t || '').toLowerCase();
    if (/contingen|no fee unless|pay nothing unless|no recovery,? no fee/.test(t)) return 'contingency';
    if (/guarantee|we promise|will win/.test(t)) return 'guarantee';
    if (/free (initial |case |strategy )?(consult|case review|evaluation|strategy session)|consultation is free|no cost consult/.test(t)) return 'consult_free';
    if (/(consult|consultation)[^.]{0,20}\$\s?\d|\$\s?\d+[^.]{0,12}consult/.test(t)) return 'consult_fee';
    if (/flat (fee|rate)|fixed fee|one price|all inclusive/.test(t)) return 'flat';
    if (/payment plan|financ|monthly payments?|interest free|pay over time/.test(t)) return 'payplan';
    if (/retainer/.test(t)) return 'retainer';
    if (/% off|percent off|discount|save \$/.test(t)) return 'discount';
    if (/se habla|habla espa|en espa|bilingual|spanish/.test(t)) return 'spanish';
    if (/same day|after hours|24\/7|weekend appointments|evenings/.test(t)) return 'fast';
    if (/virtual|video consult|zoom|online consult/.test(t)) return 'virtual';
    if (/\$\s?\d/.test(t)) return 'price';
    return 'none';
  }
  function inferHook(t) {
    t = String(t || '').toLowerCase();
    const R = [[/hiring|careers|join our team|now hiring/, 'recruiting'], [/se habla|espa[nñ]ol|bilingual|spanish/, 'Spanish'], [/military|deploy|fort (cavazos|bliss)|jbsa|veteran|service ?member/, 'military'], [/protective order|family violence|domestic violence|abuse|stay safe/, 'protective order urgency'], [/\bcps\b|dfps|removal|investigat/, 'CPS urgency'], [/laid off|layoff|job loss|lost (your |a )?job|income (drop|change)/, 'job loss'], [/new year|january/, 'new year'], [/summer|april 1/, 'summer possession'], [/back to school|school year/, 'back to school'], [/holiday|thanksgiving|christmas/, 'holidays'], [/board certified/, 'board certification'], [/aggressive|fight|bulldog|pit ?bull|tough|relentless/, 'aggressive'], [/father|\bdads?\b/, 'fathers rights'], [/mother|\bmoms?\b/, 'mothers'], [/business|high (asset|net)|stock|executive/, 'high asset'], [/free (initial |case )?consult/, 'free consultation'], [/flat (fee|rate)|fixed fee/, 'flat fee'], [/payment plan|financ|monthly/, 'payment plans'], [/review|stars?\b|rated|trusted|testimonial/, 'reviews and trust'], [/years? of experience|decades|since (19|20)\d\d|\d+\+? years/, 'experience'], [/\$\s?\d|price|cost|affordable|transparent/, 'price transparency'], [/fast|quick|same day|today|right now|24\/7|immediate/, 'speed'], [/custody|conservator|visitation|possession/, 'custody'], [/children|kids|child\b|parent/, 'children first'], [/assets|property|retirement|house|home/, 'protect assets'], [/compassion|caring|support|guide|gentle|peace|respect/, 'compassion']];
    const hit = R.find(([re]) => re.test(t)); return hit ? hit[1] : 'other';
  }
  const langOf = t => /\b(divorcio|abogad[oa]s?|custodia|consulta gratis|manutenci[oó]n|hijos|llame)\b/i.test(String(t || '')) ? 'es' : 'en';
  /* ---------- normalizers ---------- */
  function parseOffice(s) {
    if (s && typeof s === 'object') { const zip = String(s.zip || '').trim(); const z = ZI[zip]; return { label: String(s.label || ''), street: String(s.street || ''), city: String(s.city || (z ? z.city : '')), zip, county: CI[s.county] ? s.county : z ? z.county : countyOfCity(s.city) }; }
    const t = String(s || '').trim(); if (!t) return null;
    const m = t.match(/\b(7[5-9]\d{3}|885\d{2})\b/); const zip = m ? m[1] : ''; const z = ZI[zip];
    let rest = (zip ? t.replace(zip, '') : t).replace(/[,\s]+(TX|Texas)\.?(?=[,\s]*$)/i, '').replace(/[,\s]+$/, '').trim();
    const parts = rest.split(',').map(x => x.trim()).filter(Boolean);
    let city = ''; if (parts.length > 1) city = parts.pop(); else if (parts.length === 1 && !/\d/.test(parts[0])) city = parts.pop();
    if (!city && z) city = z.city; const street = parts.join(', ');
    return { label: '', street, city, zip, county: z ? z.county : countyOfCity(city) };
  }
  function lawyersFrom(v) { const arr = Array.isArray(v) ? v : String(v || '').split(/[;\n]+/); return arr.map(x => { if (x && typeof x === 'object') return { name: String(x.name || '').trim(), bar_no: String(x.bar_no || '').trim() }; const t = String(x || '').trim(); const m = t.match(/^(.*?)\s*\(?\s*(?:bar\s*(?:no\.?|number|#)?\s*)?(\d{6,9})\s*\)?\s*$/i); return m && m[1] ? { name: m[1].replace(/[,(]\s*$/, '').trim(), bar_no: m[2] } : { name: t, bar_no: '' }; }).filter(l => l.name); }
  function blankComp(c) { return Object.assign({ key: '', name: '', domain: '', tier: 'direct', counties: [], lines: [], offices: [], lawyers: [], meta_page_id: '', google_advertiser_id: '', aliases: '', notes: '', archived: false, created: today(), updated: today(), lastChecked: '' }, c || {}); }
  function normComp(c) {
    const o = blankComp(c); o.name = String(o.name || '').trim(); o.domain = domOf(o.domain); o.tier = TIERS[o.tier] ? o.tier : 'direct';
    o.offices = (Array.isArray(o.offices) ? o.offices : String(o.offices || '').split(/[;\n]+/)).map(parseOffice).filter(Boolean);
    o.counties = countiesFrom(o.counties); if (!o.counties.length) o.counties = [...new Set(o.offices.map(x => x.county).filter(f => CI[f]))];
    o.lines = linesFrom(o.lines); o.lawyers = lawyersFrom(o.lawyers);
    o.meta_page_id = String(o.meta_page_id || '').replace(/\D/g, ''); o.google_advertiser_id = String(o.google_advertiser_id || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    o.aliases = String(o.aliases || '').trim(); o.notes = String(o.notes || '').trim(); o.archived = o.archived === true || o.archived === 'true' || o.archived === 'yes';
    return o;
  }
  const lintText = o => ['ad', 'offer', 'page', 'signal'].includes(o.kind) ? [o.text, o.offer && o.offer.text, o.offer && o.offer.fin, o.cta].filter(Boolean).join(' \n') : '';
  /* LINT on competitor copy, in competitor posture: the claims in the copy only. No kind, so the firm's own footer, filing and house
     style checks do not run; rules that read the firm profile are skipped by LINT itself in this posture. */
  function lintFind(o) {
    const txt = lintText(o); if (!txt.trim() || typeof LINT === 'undefined') return [];
    let r; try { r = LINT.screen(txt, { posture: 'comp', platform: o.platform, lang: o.lang || 'en', footer: false, house: false }); } catch (e) { return []; }
    return ((r && r.findings) || []).filter(f => !SKIP_LINT.has(f.id) && !/house style/i.test(String(f.rule || '')));
  }
  function fixObs(o) {
    o = Object.assign({ id: '', comp: '', compName: '', kind: 'ad', platform: 'meta', status: 'active', first: '', last: '', format: 'other', line: '', hook: 'other', cta: '', url: '', geo: '', counties: [], zips: [], lang: 'en', snapshot: '', text: '', notes: '', src: 'manual', reviews: null, rank: null }, o || {});
    o.id = o.id || uid('ob'); o.offer = Object.assign({ type: 'none', text: '', price: null, fin: '' }, o.offer || {}); if (!OFFERS[o.offer.type]) o.offer.type = 'none'; o.offer.price = o.offer.price === '' || o.offer.price == null || !isFinite(+o.offer.price) ? null : +o.offer.price;
    o.ids = Object.assign({ lib: '', page: '', adv: '', cr: '' }, o.ids || {}); Object.keys(o.ids).forEach(k => { o.ids[k] = String(o.ids[k] == null ? '' : o.ids[k]).trim(); }); o.snapshot = safeUrl(o.snapshot);
    if (!KINDS[o.kind]) o.kind = 'note'; if (!PLATFORMS[o.platform]) o.platform = 'other'; if (!STATUSES.includes(o.status)) o.status = 'unknown';
    o.first = isoFrom(o.first) || isoFrom(o.last) || today(); o.last = isoFrom(o.last) || o.first; if (o.last < o.first) { const t = o.first; o.first = o.last; o.last = t; }
    if (!isLine(o.line)) o.line = ''; if (!HOOKS.includes(o.hook)) o.hook = 'other'; if (o.lang !== 'es') o.lang = 'en';
    o.zips = (Array.isArray(o.zips) ? o.zips : String(o.zips || '').split(/[\s,;]+/)).map(String).filter(z => ZI[z]);
    o.counties = countiesFrom(o.counties);
    if (o.reviews && (o.reviews.count === '' || o.reviews.count == null || !isFinite(+o.reviews.count))) o.reviews = null; else if (o.reviews) o.reviews = { count: +o.reviews.count, rating: o.reviews.rating === '' || o.reviews.rating == null || !isFinite(+o.reviews.rating) ? null : +o.reviews.rating, source: String(o.reviews.source || 'Google') };
    if (o.rank && !String(o.rank.query || '').trim()) o.rank = null; else if (o.rank) o.rank = { query: String(o.rank.query).trim(), position: o.rank.position === '' || o.rank.position == null || !isFinite(+o.rank.position) ? null : +o.rank.position, where: RANK_WHERE[o.rank.where] ? o.rank.where : 'organic', county: countyByName(o.rank.county) };
    if (o.comp === FIRM_KEY) o.compName = firmName(); else { const c = S && S.comps.find(x => x.key === o.comp); if (c) o.compName = c.name; else { o.comp = ''; o.compName = String(o.compName || '').trim() || 'Unmatched advertiser'; } }
    const f = lintFind(o); o.lint = f.map(x => x.id); o.lintBlock = f.filter(x => x.sev === 'block').length; o.lintFlag = f.filter(x => x.sev !== 'info').length;
    return o;
  }
  /* a new observation: first seen defaults to today; last seen defaults to today for an active ad and to the first seen date otherwise */
  function blankObs(o) { o = Object.assign({}, o || {}); const copy = [o.text, o.offer && o.offer.text].filter(Boolean).join(' '); if (copy) { if (o.line === undefined) o.line = inferLine(copy); if (o.hook === undefined) o.hook = inferHook(copy); if (o.offer === undefined) o.offer = { type: inferOffer(copy), text: '', price: priceIn(copy), fin: '' }; if (o.lang === undefined) o.lang = langOf(copy); } if (!o.first) o.first = o.last || today(); if (!o.last) o.last = (o.kind || 'ad') === 'ad' && (o.status || 'active') === 'active' ? today() : o.first; if (!o.format) o.format = (o.kind || 'ad') === 'ad' ? 'image' : 'other'; return fixObs(o); }
  /* ---------- state ---------- */
  let S = null;
  const blank = () => ({ v: 1, comps: [], obs: [], settings: { keepToken: false, token: '', apiVersion: 'v21.0', staleDays: 14 }, created: today(), updated: today() });
  function load() {
    const s = store.get(KEY, null); const b = blank();
    if (s && Array.isArray(s.comps) && Array.isArray(s.obs)) { S = Object.assign(b, s); S.settings = Object.assign(blank().settings, s.settings || {}); S.comps = s.comps.map(normComp).filter(c => c.name && c.key); S.obs = s.obs.map(fixObs); }
    else S = b;
    return S;
  }
  function save(what) { S.updated = today(); try { const s = JSON.parse(JSON.stringify(S)); if (!s.settings.keepToken) s.settings.token = ''; store.set(KEY, s); } catch (e) { } BUS.emit('watch', { what: what || 'change' }); }
  load();
  /* ---------- the roster ---------- */
  const comp = key => S.comps.find(c => c.key === key) || null;
  const list = o => S.comps.filter(c => (o && o.archived === 'all') ? true : (o && o.archived) ? c.archived : !c.archived);
  function keyFor(c) { const base = slug(c.domain || c.name) || 'competitor'; let k = base, i = 2; while (S.comps.some(x => x.key === k) || k === FIRM_KEY) k = base + '-' + i++; return k; }
  function findSame(c) { const n = normName(c.name); return S.comps.find(x => (c.key && x.key === c.key) || (c.domain && x.domain === c.domain) || (n && normName(x.name) === n && (!c.domain || !x.domain))) || null; }
  function add(c, o) {
    const n = normComp(c); if (!n.name) throw new Error('A competitor needs a name');
    const same = findSame(n); if (same) { if (o && o.merge === false) throw new Error(`${same.name} is already on the roster`); mergeInto(same, n); if (!(o && o.quiet)) save('roster'); return same; }
    n.key = keyFor(n); n.created = today(); n.updated = today(); S.comps.push(n); if (!(o && o.quiet)) save('roster'); return n;
  }
  function mergeInto(x, n) { ['domain', 'meta_page_id', 'google_advertiser_id', 'aliases', 'notes'].forEach(k => { if (!x[k] && n[k]) x[k] = n[k]; }); x.counties = [...new Set(x.counties.concat(n.counties))]; x.lines = [...new Set(x.lines.concat(n.lines))]; n.offices.forEach(of => { if (!x.offices.some(y => y.zip === of.zip && y.street === of.street && y.city === of.city)) x.offices.push(of); }); n.lawyers.forEach(l => { if (!x.lawyers.some(y => y.name.toLowerCase() === l.name.toLowerCase())) x.lawyers.push(l); }); x.updated = today(); }
  function addMany(arr) { const out = { added: [], merged: [], skipped: [] }; (arr || []).forEach(c => { try { const before = S.comps.length; const r = add(c, { quiet: true }); (S.comps.length > before ? out.added : out.merged).push(r.key); } catch (e) { out.skipped.push(e.message); } }); save('roster'); return out; }
  function update(key, patch) { const c = comp(key); if (!c) throw new Error('No competitor ' + key); const n = normComp(Object.assign({}, c, patch, { key: c.key, created: c.created })); if (!n.name) throw new Error('A competitor needs a name'); Object.assign(c, n, { updated: today() }); S.obs.forEach(o => { if (o.comp === c.key) o.compName = c.name; }); save('roster'); return c; }
  function archive(key, on) { const c = comp(key); if (!c) return null; c.archived = on !== false; c.updated = today(); save('roster'); return c; }
  function remove(key) { const n0 = S.obs.length; S.comps = S.comps.filter(c => c.key !== key); S.obs = S.obs.filter(o => o.comp !== key); save('roster'); return n0 - S.obs.length; }
  function setChecked(key, date) { const c = comp(key); if (!c) return; c.lastChecked = date || today(); save('sweep'); }
  function setIds(key, p) { const c = comp(key); if (!c) return; if (p.meta_page_id != null) c.meta_page_id = String(p.meta_page_id).replace(/\D/g, ''); if (p.google_advertiser_id != null) c.google_advertiser_id = String(p.google_advertiser_id).trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (p.aliases != null) c.aliases = String(p.aliases).trim(); c.updated = today(); save('roster'); }
  /* ---------- the ledger ---------- */
  function learnIds(ob) { const c = comp(ob.comp); if (!c) return; if (ob.ids.page && !c.meta_page_id) c.meta_page_id = ob.ids.page.replace(/\D/g, ''); if (ob.ids.adv && !c.google_advertiser_id) c.google_advertiser_id = ob.ids.adv.toUpperCase(); }
  function observe(key, o) { const ob = blankObs(Object.assign({}, o, { comp: key || (o && o.comp) || '' })); S.obs.push(ob); learnIds(ob); save('obs'); return ob; }
  function obsUpdate(id, patch) { const i = S.obs.findIndex(x => x.id === id); if (i < 0) return null; const ob = fixObs(Object.assign({}, S.obs[i], patch, { id })); S.obs[i] = ob; learnIds(ob); save('obs'); return ob; }
  function obsRemove(id) { S.obs = S.obs.filter(x => x.id !== id); save('obs'); }
  /* one observation, one key: the Meta library ID, else the Google advertiser and creative IDs, else the competitor, the platform, a hash
     of what was seen and the first seen date. Imports skip a key already in the ledger (or seen earlier in the same batch) and only move
     its last seen date forward when the copy shows it still running. */
  function hashStr(t) { let h = 2166136261; const s = String(t || ''); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function obsKey(o) {
    const ids = o.ids || {}; if (ids.lib) return 'lib:' + String(ids.lib).trim(); if (ids.adv && ids.cr) return 'g:' + String(ids.adv).trim().toUpperCase() + '/' + String(ids.cr).trim().toUpperCase();
    const what = [o.kind, String(o.text || '').replace(/\s+/g, ' ').trim().toLowerCase(), o.offer && o.offer.text, o.url, o.rank && [o.rank.query, o.rank.where, o.rank.county].join('|'), o.reviews && [o.reviews.count, o.reviews.rating, o.reviews.source].join('|'), o.text ? '' : o.notes].filter(x => x != null && x !== '').join('·');
    return 'h:' + [o.comp || ('?' + normName(o.compName || '')), o.platform || '', hashStr(what), o.first || ''].join('|');
  }
  function obsAddMany(arr, key, meta) {
    const seen = new Map(S.obs.map(o => [obsKey(o), o])); const out = []; let skipped = 0, extended = 0;
    (arr || []).forEach(o => { const ob = blankObs(o); const k = obsKey(ob); const old = seen.get(k);
      if (old) { skipped++; if (ob.last > old.last) { old.last = ob.last; if (ob.status === 'active' || ob.status === 'inactive') old.status = ob.status; extended++; } return; }
      seen.set(k, ob); S.obs.push(ob); learnIds(ob); out.push(ob); });
    if (key && comp(key) && meta) setIdsQuiet(key, meta); save('obs'); out.skipped = skipped; out.extended = extended; return out;
  }
  function setIdsQuiet(key, meta) { const c = comp(key); if (!c) return; if (meta.pageId && !c.meta_page_id) c.meta_page_id = meta.pageId; if (meta.advId && !c.google_advertiser_id) c.google_advertiser_id = meta.advId; }
  const sortObs = a => a.sort((x, y) => String(y.last).localeCompare(String(x.last)) || String(y.first).localeCompare(String(x.first)));
  const forComp = key => sortObs(S.obs.filter(o => o.comp === key));
  /* ---------- matching ---------- */
  function normName(s) { const raw = String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); const n = raw.replace(/\b(the|law|laws|lawyer|lawyers|attorney|attorneys|at|firm|group|office|offices|of|pllc|pc|p c|llp|llc|plc|inc|and|family|divorce|texas|tx)\b/g, ' ').replace(/\s+/g, ' ').trim(); return n || raw; }
  function matchComp(name, domainOrUrl, pageId) {
    if (pageId) { const p = S.comps.find(c => c.meta_page_id && c.meta_page_id === String(pageId)); if (p) return p; }
    const d = domOf(domainOrUrl); if (d) { const hit = S.comps.find(c => c.domain && (c.domain === d || d.endsWith('.' + c.domain))); if (hit) return hit; }
    const n = normName(name); if (!n) return null;
    const al = S.comps.find(c => String(c.aliases || '').split(/[;,]+/).some(a => a.trim() && normName(a) === n)); if (al) return al;
    const exact = S.comps.find(c => normName(c.name) === n); if (exact) return exact;
    const toks = n.split(' ').filter(t => t.length > 2); let best = null, bs = 0;
    S.comps.forEach(c => { const cn = normName(c.name).split(' '); const hits = toks.filter(t => cn.includes(t)).length; const sc = hits / Math.max(1, toks.length, cn.length); if (hits >= 1 && sc >= 0.5 && sc > bs) { bs = sc; best = c; } });
    return best;
  }
  /* ---------- research links: public search pages, opened by the user ---------- */
  const enc = encodeURIComponent;
  const gq = q => `https://www.google.com/search?q=${enc(q)}`;
  const LINKS = {
    metaKw: q => `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${enc(q)}&search_type=keyword_unordered&media_type=all`,
    metaKwAll: q => `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&q=${enc(q)}&search_type=keyword_unordered&media_type=all`,
    metaPage: id => `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&view_all_page_id=${enc(id)}&search_type=page&media_type=all`,
    metaLib: id => `https://www.facebook.com/ads/library/?id=${enc(id)}`,
    googleDomain: d => `https://adstransparency.google.com/?region=US&domain=${enc(domOf(d))}`,
    googleAdv: id => `https://adstransparency.google.com/advertiser/${enc(id)}?region=US`,
    googleCreative: (adv, cr) => `https://adstransparency.google.com/advertiser/${enc(adv)}/creative/${enc(cr)}?region=US`,
    googleHome: () => 'https://adstransparency.google.com/?region=US',
    /* State Bar of Texas Find a Lawyer: the search form URL is stable. Its result page takes form fields we have not verified, so a
       name search degrades to a Google search scoped to texasbar.com, which returns the member profile pages. */
    barForm: () => 'https://www.texasbar.com/AM/Template.cfm?Section=Find_A_Lawyer&Template=/CustomSource/MemberDirectory/Search_Form_Client_Main.cfm',
    barSearch: q => gq(`site:texasbar.com "${q}"`),
    /* Texas Board of Legal Specialization: tbls.org/findlawyer is the public search (specialty area, name, city, county, ZIP). Its
       result URLs are not documented, so a name search degrades to a Google search scoped to tbls.org. */
    tblsForm: () => 'https://www.tbls.org/findlawyer',
    tblsSearch: q => gq(`site:tbls.org "${q}"`),
    gMaps: (name, place) => `https://www.google.com/maps/search/?api=1&query=${enc(String(name || '') + (place ? ' ' + place : ''))}`,
    gReviews: (name, place) => gq(`${name} reviews${place ? ' ' + place : ''}`),
    gSearch: q => gq(q),
    gCounty: (county, line) => gq(`${line || 'family law attorney'} ${String(county || '').replace(/\s+county$/i, '')} County TX`),
    site: d => !d ? '' : /^https?:/i.test(d) ? d : 'https://' + hostOf(d),
    sitemap: d => d ? `https://${hostOf(d)}/sitemap.xml` : '',
    sitemapIndex: d => d ? `https://${hostOf(d)}/sitemap_index.xml` : '',
    robots: d => d ? `https://${hostOf(d)}/robots.txt` : '',
    siteIndex: d => d ? gq(`site:${domOf(d)}`) : ''
  };
  function placeOf(c) { const o = (c.offices || [])[0]; if (o && (o.city || o.zip)) return [o.city, o.zip ? 'TX ' + o.zip : 'TX'].filter(Boolean).join(' '); const f = (c.counties || [])[0]; return f && CI[f] ? CI[f].name + ' County TX' : 'Texas'; }
  function compLinks(c) {
    const L = LINKS; const out = []; const g = (grp, label, url) => { if (url) out.push({ grp, label, url }); };
    g('Ads', 'Meta Ad Library: active ads by name', L.metaKw(c.name)); g('Ads', 'Meta Ad Library: all ads by name', L.metaKwAll(c.name));
    if (c.meta_page_id) g('Ads', `Meta Ad Library: this Page (ID ${c.meta_page_id})`, L.metaPage(c.meta_page_id));
    if (c.domain) g('Ads', 'Google Ads Transparency Center: by website', L.googleDomain(c.domain)); else g('Ads', 'Google Ads Transparency Center (record a domain for a direct link)', L.googleHome());
    if (c.google_advertiser_id) g('Ads', `Google Ads Transparency Center: advertiser ${c.google_advertiser_id}`, L.googleAdv(c.google_advertiser_id));
    g('Lawyers', 'State Bar of Texas: Find a Lawyer (search form)', L.barForm()); g('Lawyers', `State Bar of Texas profiles naming ${c.name}`, L.barSearch(c.name));
    (c.lawyers || []).slice(0, 6).forEach(l => g('Lawyers', `State Bar profile: ${l.name}${l.bar_no ? ' (' + l.bar_no + ')' : ''}`, L.barSearch(l.bar_no || l.name)));
    g('Lawyers', 'Texas Board of Legal Specialization: find a certified lawyer', L.tblsForm()); (c.lawyers || []).slice(0, 6).forEach(l => g('Lawyers', `TBLS certification check: ${l.name}`, L.tblsSearch(l.name)));
    const place = placeOf(c);
    g('Search', 'Google Maps: profile, rating and review count', L.gMaps(c.name, place)); g('Search', `Google: "${c.name} reviews"`, L.gReviews(c.name));
    (c.counties || []).slice(0, 4).forEach(f => CI[f] && g('Search', `Google: family law attorney ${CI[f].name} County TX (ads, Local Services, map pack)`, L.gCounty(CI[f].name)));
    if (c.domain) { g('Site', 'Website', L.site(c.domain)); g('Site', 'Sitemap (sitemap.xml)', L.sitemap(c.domain)); g('Site', 'Sitemap index (sitemap_index.xml, WordPress)', L.sitemapIndex(c.domain)); g('Site', 'robots.txt (names the sitemap)', L.robots(c.domain)); g('Site', 'Pages Google has indexed (site: search)', L.siteIndex(c.domain)); }
    return out;
  }
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
    const out = []; let next = metaApiUrl(o), pages = 0;
    while (next && pages < (o.maxPages || 5)) { const r = await fetch(next, { mode: 'cors' }); let j; try { j = await r.json(); } catch (e) { throw new Error(`The Graph API answered ${r.status} without JSON`); } if (j.error) throw new Error(j.error.message || 'Graph API error'); (j.data || []).forEach(x => out.push(x)); next = j.paging && j.paging.next; pages++; }
    return out;
  }
  /* ---------- importers ---------- */
  function fromMetaApi(items, key) {
    return (items || []).map(x => { const caption = (x.ad_creative_link_captions || [])[0] || ''; const c = (key && comp(key) && !x.page_name) ? comp(key) : matchComp(x.page_name, caption, x.page_id); const body = (x.ad_creative_bodies || [])[0] || ''; const title = (x.ad_creative_link_titles || [])[0] || ''; const text = [title, body].filter(Boolean).join(' · ');
      return { comp: c ? c.key : '', compName: c ? c.name : (x.page_name || 'Unmatched page'), kind: 'ad', platform: 'meta', status: x.ad_delivery_stop_time ? 'inactive' : 'active', first: String(x.ad_delivery_start_time || x.ad_creation_time || '').slice(0, 10), last: String(x.ad_delivery_stop_time || today()).slice(0, 10), format: 'other', line: inferLine(text), text, hook: inferHook(text), cta: '', url: caption, lang: (x.languages || [])[0] === 'es' ? 'es' : langOf(text), ids: { lib: String(x.id || ''), page: String(x.page_id || ''), adv: '', cr: '' }, snapshot: x.ad_snapshot_url || (x.id ? LINKS.metaLib(x.id) : ''), notes: (x.publisher_platforms || []).join(', '), src: 'meta-api', offer: { type: inferOffer(text), text: '', price: priceIn(text), fin: /payment plan|financ|monthly/i.test(text) ? (text.match(/[^.]*(payment plan|financ|monthly)[^.]*/i) || [''])[0].trim() : '' } }; });
  }
  function fromUrls(text, key) {
    const out = []; const meta = {};
    String(text || '').split(/\s+/).forEach(u => { let m;
      if ((m = u.match(/ads\/library\/\?(?:[^ ]*&)?id=(\d+)/))) out.push({ comp: key || '', platform: 'meta', kind: 'ad', status: 'unknown', ids: { lib: m[1] }, snapshot: LINKS.metaLib(m[1]), src: 'import' });
      else if ((m = u.match(/view_all_page_id=(\d+)/))) meta.pageId = m[1];
      else if ((m = u.match(/adstransparency\.google\.com\/advertiser\/(AR\d+)\/creative\/(CR\d+)/))) out.push({ comp: key || '', platform: 'google', kind: 'ad', status: 'unknown', format: 'text', ids: { adv: m[1], cr: m[2] }, snapshot: u, src: 'import' });
      else if ((m = u.match(/adstransparency\.google\.com\/advertiser\/(AR\d+)/))) meta.advId = m[1]; });
    return { obs: out, meta };
  }
  const CSV_H = ['id', 'competitor', 'competitor_key', 'kind', 'platform', 'status', 'first_seen', 'last_seen', 'format', 'service_line', 'offer_type', 'offer_text', 'fee_usd', 'payment_terms', 'hook', 'cta', 'landing_url', 'geo', 'counties', 'county_fips', 'zips', 'language', 'meta_library_id', 'meta_page_id', 'google_advertiser_id', 'google_creative_id', 'snapshot_url', 'text', 'notes', 'source', 'review_count', 'review_rating', 'review_source', 'rank_query', 'rank_position', 'rank_where', 'rank_county', 'lint'];
  const toRow = o => [o.id, o.compName, o.comp, o.kind, o.platform, o.status, o.first, o.last, o.format, o.line, o.offer.type, o.offer.text, o.offer.price, o.offer.fin, o.hook, o.cta, o.url, o.geo, (o.counties || []).map(f => CI[f] ? CI[f].name : f).join('; '), (o.counties || []).join(' '), (o.zips || []).join(' '), o.lang, o.ids.lib, o.ids.page, o.ids.adv, o.ids.cr, o.snapshot, o.text, o.notes, o.src, o.reviews ? o.reviews.count : '', o.reviews ? o.reviews.rating : '', o.reviews ? o.reviews.source : '', o.rank ? o.rank.query : '', o.rank ? o.rank.position : '', o.rank ? o.rank.where : '', o.rank && o.rank.county ? (CI[o.rank.county] || {}).name || '' : '', (o.lint || []).join(' ')];
  function fromLedgerRows(rows) {
    rows = unguardRows(rows); const H = rows[0].map(h => String(h).trim().toLowerCase()); const g = (r, k) => { const i = H.indexOf(k); return i >= 0 ? String(r[i] == null ? '' : r[i]).trim() : ''; };
    return rows.slice(1).map(r => { const key = g(r, 'competitor_key'); const c = key === FIRM_KEY ? { key: FIRM_KEY, name: firmName() } : comp(key) || matchComp(g(r, 'competitor'), g(r, 'landing_url'), g(r, 'meta_page_id')); const text = g(r, 'text'), ot = g(r, 'offer_text');
      return { id: g(r, 'id') && !S.obs.some(o => o.id === g(r, 'id')) ? g(r, 'id') : '', comp: c ? c.key : '', compName: c ? c.name : g(r, 'competitor'), kind: KINDS[g(r, 'kind')] ? g(r, 'kind') : 'ad', platform: PLATFORMS[g(r, 'platform')] ? g(r, 'platform') : 'other', status: g(r, 'status') || 'unknown', first: g(r, 'first_seen'), last: g(r, 'last_seen'), format: g(r, 'format') || 'other', line: isLine(g(r, 'service_line')) ? g(r, 'service_line') : inferLine(text + ' ' + ot), offer: { type: OFFERS[g(r, 'offer_type')] ? g(r, 'offer_type') : inferOffer(ot || text), text: ot, price: g(r, 'fee_usd') || g(r, 'price_usd') ? +(g(r, 'fee_usd') || g(r, 'price_usd')) : priceIn(ot), fin: g(r, 'payment_terms') || g(r, 'financing_terms') }, hook: HOOKS.includes(g(r, 'hook')) ? g(r, 'hook') : inferHook(text), cta: g(r, 'cta'), url: g(r, 'landing_url'), geo: g(r, 'geo'), counties: g(r, 'county_fips') ? g(r, 'county_fips').split(/[\s,;]+/) : g(r, 'counties'), zips: g(r, 'zips'), lang: g(r, 'language') === 'es' ? 'es' : 'en', ids: { lib: g(r, 'meta_library_id'), page: g(r, 'meta_page_id'), adv: g(r, 'google_advertiser_id'), cr: g(r, 'google_creative_id') }, snapshot: g(r, 'snapshot_url'), text, notes: g(r, 'notes'), src: g(r, 'source') && g(r, 'source') !== 'manual' ? g(r, 'source') : 'import', reviews: g(r, 'review_count') ? { count: +g(r, 'review_count'), rating: g(r, 'review_rating'), source: g(r, 'review_source') || 'Google' } : null, rank: g(r, 'rank_query') ? { query: g(r, 'rank_query'), position: g(r, 'rank_position'), where: g(r, 'rank_where'), county: g(r, 'rank_county') } : null }; });
  }
  const ROSTER_H = ['key', 'name', 'domain', 'tier', 'counties', 'county_fips', 'lines', 'offices', 'lawyers', 'meta_page_id', 'google_advertiser_id', 'aliases', 'notes', 'archived', 'created', 'last_checked', 'activity_score', 'live_ads', 'observations', 'review_count', 'review_rating', 'review_velocity_month', 'firm_counties_covered', 'meta_ad_library', 'google_transparency', 'state_bar_search', 'tbls_search', 'google_maps'];
  const officeStr = o => [o.street, o.city, o.zip ? 'TX ' + o.zip : ''].filter(Boolean).join(', ');
  const lawyerStr = l => l.name + (l.bar_no ? ` (${l.bar_no})` : '');
  function fromRosterRows(rows) {
    rows = unguardRows(rows); const H = rows[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_')); const ix = names => { for (const n of names) { const i = H.indexOf(n); if (i >= 0) return i; } return -1; };
    const col = { name: ix(['name', 'firm', 'firm_name', 'competitor', 'company']), domain: ix(['domain', 'website', 'url', 'site']), tier: ix(['tier', 'type']), counties: ix(['county_fips']), cnames: ix(['counties', 'county']), lines: ix(['lines', 'service_lines', 'practice_areas']), offices: ix(['offices', 'office', 'address', 'addresses']), lawyers: ix(['lawyers', 'attorneys']), page: ix(['meta_page_id']), adv: ix(['google_advertiser_id']), aliases: ix(['aliases']), notes: ix(['notes']), archived: ix(['archived']), checked: ix(['last_checked']) };
    const g = (r, i) => i >= 0 ? String(r[i] == null ? '' : r[i]).trim() : '';
    return rows.slice(1).map(r => ({ name: g(r, col.name), domain: g(r, col.domain), tier: tierOf(g(r, col.tier)), counties: g(r, col.counties) ? g(r, col.counties).split(/[\s,;]+/) : g(r, col.cnames), lines: g(r, col.lines), offices: g(r, col.offices).split(/;|\n/), lawyers: g(r, col.lawyers), meta_page_id: g(r, col.page), google_advertiser_id: g(r, col.adv), aliases: g(r, col.aliases), notes: g(r, col.notes), archived: /^(true|yes|1)$/i.test(g(r, col.archived)), lastChecked: isoFrom(g(r, col.checked)) })).filter(c => c.name);
  }
  const tierOf = t => { t = String(t || '').toLowerCase(); return TIERS[t] ? t : /legal ?aid|nonprofit|non profit|pro bono/.test(t) ? 'legalaid' : /referr|partner/.test(t) ? 'referral' : /adjacent|general|overlap/.test(t) ? 'adjacent' : 'direct'; };
  /* bulk paste: a roster CSV with a header, or one competitor per line (fields split by tab, |, ; or comma, recognized by shape) */
  function parseRosterText(text) {
    const t = String(text || '').replace(/^﻿/, '').trim(); if (!t) return { comps: [], skipped: [] };
    const first = t.split('\n').find(l => l.trim() && !/^#/.test(l.trim())) || '';
    if (/(^|[,\t])\s*"?(name|firm|firm name|competitor|company)"?\s*([,\t]|$)/i.test(first)) { const rows = parseCSV(t); return { comps: fromRosterRows(rows).map(normComp), skipped: [] }; }
    const comps = [], skipped = [];
    t.split('\n').map(l => l.trim()).filter(l => l && !/^#/.test(l)).forEach(line => {
      const sep = line.includes('\t') ? '\t' : line.includes('|') ? '|' : line.includes(',') ? ',' : ';'; const fields = line.split(sep).map(x => x.trim()).filter(Boolean);
      const c = { name: '', domain: '', tier: 'direct', counties: [], lines: [], offices: [], notes: [] };
      fields.forEach(f => { const lo = f.toLowerCase();
        if (/^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(f) && !/\s/.test(f)) { if (!c.domain) c.domain = domOf(f); return; }
        if (TIERS[lo] || /^(direct|adjacent|general practice|referral( partner)?|legal aid|nonprofit)$/.test(lo)) { c.tier = tierOf(lo); return; }
        if (/\b(7[5-9]\d{3}|885\d{2})\b/.test(f)) { c.offices.push(f); return; }
        if (c.name) { const ls = f.length < 80 ? linesFrom(f) : []; const cs = countiesFrom(f.replace(/\bcount(y|ies)\b/gi, '')); if (cs.length && (/count(y|ies)/i.test(f) || !ls.length)) { c.counties.push(...cs); return; } if (ls.length) { c.lines.push(...ls); return; } }
        if (!c.name) { c.name = f; return; } c.notes.push(f); });
      if (!c.name) { skipped.push(line); return; } c.notes = c.notes.join('; '); comps.push(normComp(c));
    });
    return { comps, skipped };
  }
  /* copied ad text: Meta Ad Library cards (Active, Library ID, Started running on, Page name, Sponsored, copy, domain, call to action)
     and Google search ads (Sponsored, advertiser, URL line, headline, description). Returns a draft observation for the log form. */
  const CTAS = ['learn more', 'call now', 'book now', 'contact us', 'send message', 'sign up', 'get quote', 'apply now', 'get offer', 'book a consultation', 'schedule now', 'request time', 'send whatsapp message', 'get directions', 'call', 'visit website', 'message', 'subscribe', 'download', 'get started', 'free consultation', 'see more'];
  const BOILER = [/^(active|inactive)$/i, /^library id/i, /^started running/i, /^platforms?$/i, /^see (ad|summary) details$/i, /^this ad has multiple versions$/i, /^\d+ ads? uses? this creative/i, /^sponsored$/i, /^ad$/i, /^ad\s*·/i, /^open dropdown$/i, /^about the advertiser/i, /^why am i seeing/i, /^total active time/i, /^eu transparency/i, /^see less$/i, /^paid for by/i, /^my ad center$/i, /^disclaimer/i, /^[•·…]+$/, /^\d+$/, /^ad details$/i, /^report ad$/i];
  function parseAdText(text, key) {
    const raw = String(text || '').replace(/\r/g, ''); const lines = raw.split('\n').map(l => l.trim()).filter(Boolean); const parsed = [];
    const lib = (raw.match(/Library ID:?\s*(\d{6,})/i) || [])[1] || '';
    const started = (raw.match(/Started running on\s+([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4})/i) || [])[1] || '';
    const range = raw.match(/([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})\s*(?:-|–|—|to)\s*([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})/);
    const isMeta = !!(lib || started || /facebook|instagram|messenger|audience network/i.test(raw)); const isGoogle = !isMeta && (/›/.test(raw) || /^sponsored$/im.test(raw));
    let status = /^\s*inactive\s*$/im.test(raw) ? 'inactive' : /^\s*active\s*$/im.test(raw) ? 'active' : 'unknown';
    let first = range ? isoFrom(range[1]) : isoFrom(started); let last = range ? isoFrom(range[2]) : status === 'active' ? today() : first;
    if (!first) first = today(); if (!last) last = first; if (range && status === 'unknown') status = 'inactive';
    const isUrl = l => /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\s*›.*|\/\S*)?$/i.test(l) && !/\s/.test(l.replace(/\s*›.*$/, ''));
    const urlIdx = lines.findIndex(isUrl);
    const url = urlIdx >= 0 ? lines[urlIdx].replace(/\s*›.*$/, '').trim() : ((raw.match(/https?:\/\/[^\s›]+/) || [])[0] || ''); const dom = domOf(url);
    const spIdx = lines.findIndex(l => /^sponsored$/i.test(l)); const isB = l => BOILER.some(re => re.test(l));
    let page = ''; if (spIdx >= 0) { if (isGoogle) { const n = lines.slice(spIdx + 1).find(l => !isB(l)); if (n && n !== lines[urlIdx]) page = n; } else { for (let i = spIdx - 1; i >= 0; i--) if (!isB(lines[i])) { page = lines[i]; break; } } }
    const ctaLine = lines.slice().reverse().find(l => CTAS.includes(l.toLowerCase())) || '';
    const used = new Set([page, ctaLine, urlIdx >= 0 ? lines[urlIdx] : '']);
    const body = lines.filter(l => !isB(l) && !used.has(l) && !isUrl(l) && !/^(library id|started running)/i.test(l)); const copy = body.join(' ').replace(/\s{2,}/g, ' ').trim();
    const c = matchComp(page, dom) || (!page && !dom ? comp(key) : null);   // the selected competitor only when the text names no advertiser
    const offerSentence = (copy.match(/[^.!?]*(free (initial |case )?consult|flat (fee|rate)|\$\s?\d|payment plan|retainer|% off|discount|contingen|no fee unless)[^.!?]*[.!?]?/i) || [''])[0].trim();
    const otype = inferOffer(copy);
    const out = { comp: c ? c.key : '', compName: c ? c.name : (page || ''), kind: 'ad', platform: isMeta ? 'meta' : isGoogle ? 'google' : 'other', status, first, last, format: isGoogle ? 'text' : /\b\d{1,2}:\d{2}\b/.test(raw) ? 'video' : 'image', line: inferLine(copy), offer: { type: otype, text: otype === 'none' ? '' : offerSentence, price: priceIn(offerSentence) != null ? priceIn(offerSentence) : priceIn(copy), fin: /payment plan|financ|monthly/i.test(copy) ? (copy.match(/[^.]*(payment plan|financ|monthly)[^.]*/i) || [''])[0].trim() : '' }, hook: inferHook(copy), cta: ctaLine, url: url || (dom ? dom : ''), lang: langOf(copy), ids: { lib, page: '', adv: '', cr: '' }, snapshot: lib ? LINKS.metaLib(lib) : '', text: copy, src: 'paste' };
    if (lib) parsed.push('library ID'); if (started || range) parsed.push('dates'); if (status !== 'unknown') parsed.push('status'); if (page) parsed.push('advertiser'); if (c) parsed.push('roster match'); if (url) parsed.push('landing page'); if (ctaLine) parsed.push('call to action'); if (out.line) parsed.push('service line'); if (otype !== 'none') parsed.push('offer'); if (out.offer.price != null) parsed.push('fee'); if (copy) parsed.push('copy');
    out.parsed = parsed; return out;
  }
  function importText(text, key) {
    const R = o => Object.assign({ obs: [], comps: [], meta: {}, draft: null, backup: null, note: '' }, o);
    const t = String(text || '').replace(/^﻿/, '').trim(); if (!t) return R({ note: 'Nothing to import' });
    if (t[0] === '{' || t[0] === '[') {
      let j; try { j = JSON.parse(t); } catch (e) { return R({ note: 'That is not valid JSON' }); }
      if (j && Array.isArray(j.comps) && Array.isArray(j.obs)) return R({ backup: j, note: `a Competitor Watch backup with ${j.comps.length} competitors and ${j.obs.length} observations` });
      if (j && Array.isArray(j.obs)) return R({ obs: j.obs.map(o => Object.assign({}, o, { id: '', src: 'import' })), note: `${j.obs.length} ledger entries` });
      const items = Array.isArray(j) ? j : (j && j.data) || [];
      if (items.length && items.every(x => x && typeof x === 'object' && !('page_name' in x) && !('ad_creative_bodies' in x) && 'name' in x)) return R({ comps: items.map(normComp).filter(c => c.name), note: `${items.length} competitors` });
      return R({ obs: fromMetaApi(items, key), note: `${items.length} ads from a Meta Ad Library API response` });
    }
    if (/Library ID|Started running on/i.test(t) || /^sponsored$/im.test(t)) { const d = parseAdText(t, key); return R({ draft: d, note: `copied ad text; filled ${d.parsed.join(', ') || 'the copy'}` }); }
    if (/adstransparency\.google\.com|facebook\.com\/ads\/library/.test(t) && t.split(/\s+/).every(w => /^https?:\/\//.test(w))) { const r = fromUrls(t, key); return R({ obs: r.obs, meta: r.meta, note: `${r.obs.length} ad links${r.meta.pageId ? ', a Meta Page ID' : ''}${r.meta.advId ? ', a Google advertiser ID' : ''}` }); }
    const head = (t.split('\n').find(l => l.trim() && !/^#/.test(l.trim())) || '').toLowerCase();
    if (/[,\t]/.test(head) && /\bcompetitor(_key)?\b/.test(head) && /\bkind\b|first_seen/.test(head)) { const rows = parseCSV(t); const o = fromLedgerRows(rows); return R({ obs: o, note: `${o.length} rows from a ledger CSV` }); }
    if (/[,\t]/.test(head) && /(^|[,\t])\s*"?(name|firm|firm name|competitor|company)"?\s*([,\t]|$)/.test(head)) { const r = parseRosterText(t); return R({ comps: r.comps, note: `${r.comps.length} competitors from a roster CSV` }); }
    const d = parseAdText(t, key); return R({ draft: d, note: `pasted copy; filled ${d.parsed.join(', ') || 'the copy'}` });
  }
  function importBackup(j, mode) {
    if (!j || !Array.isArray(j.comps) || !Array.isArray(j.obs)) throw new Error('This file is not a Competitor Watch backup');
    if (mode === 'replace') { const keep = S.settings; S = Object.assign(blank(), { comps: [], obs: [], created: j.created || today() }); S.settings = Object.assign(blank().settings, j.settings || {}, { token: keep.keepToken ? keep.token : '', keepToken: keep.keepToken }); j.comps.map(normComp).forEach(c => { if (c.name) { if (!c.key || S.comps.some(x => x.key === c.key)) c.key = keyFor(c); S.comps.push(c); } }); S.obs = j.obs.map(fixObs); save('replace'); return { comps: S.comps.length, obs: S.obs.length, mode }; }
    let nc = 0, no = 0; j.comps.map(normComp).forEach(c => { if (!c.name) return; const same = S.comps.find(x => x.key === c.key) || findSame(c); if (same) mergeInto(same, c); else { if (!c.key || S.comps.some(x => x.key === c.key)) c.key = keyFor(c); S.comps.push(c); nc++; } });
    const seen = new Map(S.obs.map(o => [obsKey(o), o])); let skipped = 0;
    j.obs.forEach(o => { if (o.id && S.obs.some(x => x.id === o.id)) { skipped++; return; } const ob = fixObs(o); const k = obsKey(ob); const old = seen.get(k); if (old) { skipped++; if (ob.last > old.last) old.last = ob.last; return; } seen.set(k, ob); S.obs.push(ob); no++; }); save('merge'); return { comps: nc, obs: no, skipped, mode: 'merge' };
  }
  function clear() { const n = { comps: S.comps.length, obs: S.obs.length }; S = blank(); save('clear'); return n; }
  /* ---------- analytics ---------- */
  function scoreDetail(c) {
    const key = typeof c === 'string' ? c : c.key; const obs = forComp(key); const parts = { ads: 0, offers: 0, pages: 0, ranks: 0, reviews: 0, events: 0, platforms: 0 }; const plats = new Set();
    obs.forEach(o => { const liveNow = isLiveAd(o) && o.status === 'active'; const age = liveNow ? 0 : Math.max(0, daysAgo(o.last || o.first)); if (age > 365) return; const w = Math.pow(0.5, age / HALF_LIFE);
      switch (o.kind) { case 'ad': parts.ads += 10 * w; if (age <= 120) plats.add(o.platform); break; case 'offer': parts.offers += 5 * w; break; case 'page': case 'signal': parts.pages += 3 * w; break; case 'rank': { const p = o.rank && isN(o.rank.position) ? o.rank.position : null; parts.ranks += (p == null ? 1 : p <= 3 ? 6 : p <= 10 ? 3 : 1) * w; break; } case 'review': parts.reviews += 2 * w; break; case 'event': parts.events += 3 * w; break; default: break; } });
    const cap = { ads: 50, offers: 15, pages: 10, ranks: 12, reviews: 4, events: 4 }; Object.keys(cap).forEach(k => { parts[k] = Math.min(cap[k], parts[k]); }); parts.platforms = Math.min(15, plats.size * 5);
    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    return { score: Math.round(Math.min(100, total)), parts, platforms: [...plats], live: obs.filter(isLiveAd).length, n: obs.length, last: obs.length ? obs[0].last : '' };
  }
  const score = c => scoreDetail(c).score;
  function reviews(key) {
    const snaps = S.obs.filter(o => o.comp === key && o.kind === 'review' && o.reviews && isN(o.reviews.count)).map(o => ({ date: o.last || o.first, count: o.reviews.count, rating: o.reviews.rating, source: o.reviews.source || 'Google', id: o.id })).sort((a, b) => a.date.localeCompare(b.date));
    let latest = snaps.length ? snaps[snaps.length - 1] : null;
    if (!latest && key === FIRM_KEY && typeof FIRM !== 'undefined') { const r = FIRM.get().reviews || {}; if (r.count !== '' && r.count != null && isFinite(+r.count)) latest = { date: '', count: +r.count, rating: r.rating === '' || r.rating == null ? null : +r.rating, source: (r.source || 'Google') + ' (firm profile)' }; }
    let velocity = null, span = null; const win = snaps.filter(s => daysAgo(s.date) <= 400);
    if (win.length >= 2) { const a = win[0], b = win[win.length - 1]; span = (Date.parse(b.date) - Date.parse(a.date)) / 864e5; if (span >= 14) velocity = (b.count - a.count) / span * 30; }
    return { snaps, latest, velocity, span };
  }
  const firmCounties = () => (typeof FIRM !== 'undefined' ? FIRM.counties() : []).filter(f => CI[f]);
  const firmLines = () => (typeof FIRM !== 'undefined' ? FIRM.lines() : []);
  const priv = f => (CI[f] && CI[f].filings && CI[f].filings.ttm && CI[f].filings.ttm.priv) || 0;
  function coverage(c) {
    const F = firmCounties(); const cs = new Set((c.counties || []).concat((c.offices || []).map(o => o.county)).filter(Boolean));
    if (!F.length) return { share: null, filingShare: null, covered: [], of: 0 };
    const covered = F.filter(f => cs.has(f)); const tot = sum(F.map(priv));
    return { share: covered.length / F.length, filingShare: tot ? sum(covered.map(priv)) / tot : null, covered, of: F.length };
  }
  function lineOverlap(c) { const FL = firmLines(); if (!FL.length) return { share: null, both: [], of: 0 }; const both = FL.filter(l => (c.lines || []).includes(l)); return { share: both.length / FL.length, both, of: FL.length }; }
  function stats() {
    const obs = S.obs.filter(o => o.comp !== FIRM_KEY); const ads = obs.filter(o => o.kind === 'ad'); const live = ads.filter(isLive); const byComp = {}; live.forEach(o => { const k = o.comp || ('?' + o.compName); byComp[k] = (byComp[k] || 0) + 1; });
    const byPlat = {}; live.forEach(o => { byPlat[o.platform] = (byPlat[o.platform] || 0) + 1; });
    const offers = obs.filter(o => o.kind === 'offer' || (o.offer && o.offer.type !== 'none')); const byOffer = {}; offers.forEach(o => { byOffer[o.offer.type] = (byOffer[o.offer.type] || 0) + 1; });
    const byHook = {}; obs.forEach(o => { if (o.hook && ['ad', 'offer', 'page'].includes(o.kind)) byHook[o.hook] = (byHook[o.hook] || 0) + 1; });
    const byLine = {}; obs.forEach(o => { if (o.line) byLine[o.line] = (byLine[o.line] || 0) + 1; });
    const prices = offers.filter(o => isN(o.offer.price)).map(o => ({ comp: o.compName, key: o.comp, line: o.line || inferLine(o.text), type: o.offer.type, price: +o.offer.price, text: o.offer.text || o.text, last: o.last, id: o.id }));
    const terms = offers.filter(o => o.offer.type === 'payplan' || o.offer.fin).map(o => ({ comp: o.compName, text: o.offer.fin || o.offer.text || o.text, last: o.last, lint: o.lint || [] }));
    const lastObs = S.obs.map(o => o.last).sort().pop() || null; const lastSweep = S.comps.map(c => c.lastChecked).filter(Boolean).sort().pop() || null;
    return { n: obs.length, ads: ads.length, live: live.length, byComp, byPlat, byOffer, byHook, byLine, prices, terms, comps: list().length, archived: list({ archived: true }).length, lastObs, lastSweep, lints: obs.filter(o => o.lintFlag).length, blocks: obs.filter(o => o.lintBlock).length, unmatched: obs.filter(o => !o.comp).length };
  }
  function weekly(weeks) {
    weeks = weeks || 26; const now = nowMs(); const out = Array.from({ length: weeks }, (_, i) => ({ w: i, t: now - (weeks - 1 - i) * 7 * 864e5, meta: 0, google: 0, other: 0 }));
    S.obs.forEach(o => { if (o.kind !== 'ad' || o.comp === FIRM_KEY) return; const t = Date.parse((o.first || o.last) + 'T12:00:00Z'); if (!isN(t)) return; const i = weeks - 1 - Math.floor(Math.max(0, (now - t) / (7 * 864e5))); if (i < 0) return; const k = o.platform === 'meta' ? 'meta' : ['google', 'lsa', 'youtube'].includes(o.platform) ? 'google' : 'other'; out[i][k]++; });
    return out;
  }
  const activeAds = () => S.obs.filter(o => o.comp !== FIRM_KEY && isLiveAd(o)).sort((a, b) => String(b.first).localeCompare(String(a.first)));
  const timeline = () => sortObs(S.obs.slice());
  /* counties an observation names: its county list, the counties of its ZIPs, county names in the geography text */
  function obsCounties(o) { const s = new Set(o.counties || []); (o.zips || []).forEach(z => { if (ZI[z]) s.add(ZI[z].county); }); String(o.geo || '').split(/[,;/]+/).forEach(g => { const f = countyByName(g.replace(/\bcounty\b/i, '').trim()); if (f && /county/i.test(g)) s.add(f); else { const cc = countyOfCity(g.trim()); if (cc) s.add(cc); } }); if (o.rank && o.rank.county) s.add(o.rank.county); return [...s]; }
  function countyCounts() { const m = {}; S.obs.forEach(o => { if (o.comp === FIRM_KEY || (o.kind === 'ad' && !isLive(o))) return; obsCounties(o).forEach(f => { m[f] = (m[f] || 0) + 1; }); }); return m; }
  function rosterByCounty() { const m = {}; list().forEach(c => new Set((c.counties || []).concat((c.offices || []).map(o => o.county)).filter(Boolean)).forEach(f => { (m[f] = m[f] || []).push(c.key); })); return m; }
  /* the field's paid pressure by county for other modules (the Thermal Atlas fed its paid pressure the same way): live competitor ads
     seen in the last 120 days, placed in the counties they name, else the counties the competitor serves; {fips: {_all, <line>: n}} */
  function activity() {
    const out = {}; S.obs.forEach(o => { if (o.comp === FIRM_KEY || !isLiveAd(o) || daysAgo(o.last) > 120) return; let fs = obsCounties(o); if (!fs.length) { const c = comp(o.comp); fs = c ? c.counties : []; }
      fs.forEach(f => { const a = out[f] = out[f] || { _all: 0 }; a._all++; if (o.line) a[o.line] = (a[o.line] || 0) + 1; }); });
    return out;
  }
  function context(fipsList) {
    const F = (fipsList && fipsList.length ? fipsList : firmCounties()).filter(f => CI[f]); const rb = rosterByCounty(); const cc = countyCounts();
    const rows = F.map(f => { const c = CI[f]; const lo = c.rates.lawoffices || 0; const tracked = (rb[f] || []).length; return { fips: f, name: c.name, lawoffices: c.rates.lawoffices, legal_emp: c.rates.legal_emp, priv: priv(f), div: (c.filings.ttm || {}).div, fpo: c.rates.filings_per_lawoffice, tracked, trackedShare: lo ? tracked / lo : null, named: cc[f] || 0 }; });
    const offices = sum(rows.map(r => r.lawoffices || 0)), filings = sum(rows.map(r => r.priv || 0)); const trackedSet = new Set(); F.forEach(f => (rb[f] || []).forEach(k => trackedSet.add(k)));
    const stOff = sum(CTY.map(c => c.rates.lawoffices || 0)), stPriv = sum(CTY.map(c => (c.filings.ttm || {}).priv || 0));
    return { counties: F, rows, offices, filings, fpo: offices ? filings / offices : null, tracked: trackedSet.size, trackedPer100: offices ? trackedSet.size / offices * 100 : null, stateFpo: stOff ? stPriv / stOff : null, firm: F.length > 0 && !(fipsList && fipsList.length) };
  }
  function uncontested(fipsList, n) {
    const cc = countyCounts(); const rb = rosterByCounty(); const live = new Set(); activeAds().forEach(o => obsCounties(o).forEach(f => live.add(f)));
    const pool = (fipsList && fipsList.length ? fipsList.map(f => CI[f]).filter(Boolean) : CTY.filter(c => ((c.filings.ttm || {}).priv || 0) >= 200));
    return pool.filter(c => isN(c.rates.filings_per_lawoffice) && !cc[c.fips] && !live.has(c.fips)).sort((a, b) => b.rates.filings_per_lawoffice - a.rates.filings_per_lawoffice).slice(0, n || 12).map(c => ({ fips: c.fips, name: c.name, fpo: c.rates.filings_per_lawoffice, lawoffices: c.rates.lawoffices, priv: priv(c.fips), tracked: (rb[c.fips] || []).length }));
  }
  /* ---------- LINT on the field's copy: which claims would be violations if the firm made them ---------- */
  const POSITION = [
    [/guarantee/i, 'An outcome promise is a misleading communication under Rule 7.01(a). Describe the process instead: the first meeting, the written fee agreement, the timeline the Family Code sets.'],
    [/special competence|certified|certification/i, 'Only a Texas Board of Legal Specialization certification may be advertised as a specialty (Rule 7.02(b)). Where a lawyer holds it, the exact wording "Board Certified, Family Law, Texas Board of Legal Specialization" is a lawful differentiator; otherwise "practice focused on family law" is the lawful phrase.'],
    [/superlative|#1|number one/i, 'Unverifiable "#1" and "best" claims leave room for facts a reader can check: years licensed, counties served, languages spoken, a review count with its source and date.'],
    [/contingent/i, 'A contingent fee that depends on securing a divorce or on the amount of support or property is prohibited (Rule 1.04(e)). Plain flat fee or hourly language reads as the trustworthy option beside it.'],
    [/past results/i, 'Dollar results say little about the next family case. Explaining how a Texas court divides property (just and right, § 7.001) answers the question readers actually have.'],
    [/testimonial|review/i, 'Reviews are allowed when truthful and not misleading, and a paid or incentivized endorsement must say so. Cite your own review count with its source and date.'],
    [/property/i, 'Texas divides community property in a manner that is just and right, not necessarily equally (§ 7.001). Stating it correctly is an easy authority signal.'],
    [/legal separation/i, 'Texas has no legal separation. Content on temporary orders, protective orders and partition agreements answers the searcher correctly.'],
    [/gender/i, 'Courts may not prefer a parent by sex (§ 153.003). Copy that speaks to both parents is accurate and reaches both audiences.'],
    [/at 12|chooses/i, 'At 12 the judge must interview the child in chambers on request, and the preference never controls (§ 153.009). Saying so plainly sets your copy apart.'],
    [/common law/i, 'An informal marriage has no duration element (§ 2.401): agreement, living together in Texas and holding out.'],
    [/alimony/i, 'Spousal maintenance exists, is limited and is capped at the lesser of $5,000 a month or 20% of average gross income (chapter 8).'],
    [/child support cap|at the cap/i, 'The guideline cap is $11,700 in monthly net resources since September 1, 2025 ($2,340 a month for one child at the cap). A competitor citing an older figure leaves room for your accurate number.'],
    [/sixty days/i, 'Sixty days is the statutory minimum from filing (§ 6.702), not a delivery time. A realistic timeline builds trust.'],
    [/protective order: proof/i, 'Since 2023 the applicant proves that family violence occurred, not that it will recur (chapter 85). Stating the current standard is accurate and reassuring.'],
    [/protective order duration/i, 'Since September 2025 an order tied to a pending divorce or SAPCR can run until two years after the final decree; a flat duration misstates it.'],
    [/restraining/i, 'A temporary restraining order and a protective order are different remedies; naming the right one is accurate and helps searchers.'],
    [/equal time/i, 'Texas has no equal time presumption; joint managing conservatorship does not mean equal time.'],
    [/expanded possession/i, 'The expanded standard possession order has been the default within 50 miles since 2021; it is not new.'],
    [/support and possession/i, 'Support and possession are independent obligations (the § 105.006(e) warning): unpaid support does not justify withholding access, and denied access does not stop support.'],
    [/birth certificate/i, 'Parental rights attach through an acknowledgment of paternity or an adjudication, not the birth certificate (chapter 160).'],
    [/prenup/i, 'Texas premarital agreements are enforced unless one of the § 4.006 defenses is proven; accurate copy on that is a strong prenup message.'],
    [/lay terms/i, 'Pair the lay term with the Texas term (conservatorship, possession and access) on your own pages.'],
    [/arrears/i, 'Child support arrears accrue 6% simple interest (§ 157.265) and stay enforceable long after the order ends (§ 157.005).'],
    [/termination ground/i, 'Ground (O) was repealed effective September 1, 2025.'],
    [/anonymous/i, 'DFPS has not accepted anonymous reports since September 1, 2023.'],
    [/government office|legal aid/i, 'A name may not imply a connection with a government agency, a court or a legal aid organization; your own firm name and responsible lawyer are the plain contrast.'],
    [/personal attribute|hardship/i, 'A platform policy rather than a disciplinary rule: write to the situation in the third person ("Divorce with children in Harris County") and target by keyword and geography.'],
    [/editorial|phone number/i, 'A platform editorial rule: no exclamation marks or all capitals in headlines, and phone numbers in call assets.'],
    [/urgency/i, 'Invented deadlines read as pressure. Real dates are the honest urgency: the April 1 summer possession notice, the 60 day waiting period.'],
    [/availability/i, 'A "24/7" or "same day" claim must be true whenever the ad runs; state the hours you actually keep.'],
    [/advertised fee/i, 'An advertised fee binds the advertiser while the ad runs (Rule 7.02(d)). If you advertise one, record it in the firm profile so every ad and page states the same number.'],
    [/aggression/i, 'Not a violation by itself. Calm, clear copy is the lawful contrast, and judges and mediators read ads too.']
  ];
  const positionFor = title => { const p = POSITION.find(([re]) => re.test(String(title || ''))); return p ? p[1] : 'Your own copy must not repeat this claim; the rule, the reason and the fix are in the Compliance Screen (module 11).'; };
  function claims() {
    const m = {}; S.obs.forEach(o => { if (o.comp === FIRM_KEY) return; lintFind(o).forEach(f => { const r = m[f.id] = m[f.id] || { id: f.id, title: f.title, rule: f.rule, sev: f.sev, why: f.why, n: 0, comps: new Set(), examples: [] }; r.n++; r.comps.add(o.compName); if (r.examples.length < 4) r.examples.push({ comp: o.compName, key: o.comp, hit: f.hit, id: o.id, platform: o.platform, last: o.last }); }); });
    const rank = { block: 0, fix: 1, warn: 2, info: 3 };
    return Object.values(m).map(r => Object.assign(r, { comps: [...r.comps], position: positionFor(r.title) })).sort((a, b) => (rank[a.sev] - rank[b.sev]) || b.n - a.n);
  }
  /* ---------- compare: the firm beside up to four competitors ---------- */
  function profileOf(key) {
    const isF = key === FIRM_KEY; const f = typeof FIRM !== 'undefined' ? FIRM.get() : {}; const c = isF ? { key, name: firmName(), tier: 'firm', counties: firmCounties(), lines: firmLines(), offices: (f.offices || []).filter(o => o.city || o.zip).map(parseOffice), domain: domOf(f.url), lawyers: (f.attorneys || []).filter(a => a.name).map(a => ({ name: a.name, bar_no: a.bar_no || '' })), lastChecked: '' } : comp(key);
    if (!c) return null; const obs = forComp(key); const sd = scoreDetail(key); const rv = reviews(key);
    const fees = isF ? Object.keys(f.fees || {}).filter(k => isN(f.fees[k]) && f.fees[k] > 0).map(k => ({ line: k, price: f.fees[k] })) : obs.filter(o => isN(o.offer.price) && o.offer.type !== 'discount').map(o => ({ line: o.line, price: o.offer.price, type: o.offer.type }));
    const freeConsult = isF ? !!(f.consult && f.consult.free) : obs.some(o => o.offer.type === 'consult_free' || /free (initial |case )?consult/i.test(lintText(o))) ? true : null;
    const spanish = isF ? (f.languages || []).includes('es') : obs.some(o => o.lang === 'es' || o.offer.type === 'spanish' || /se habla|bilingual|en espa[nñ]ol/i.test(lintText(o))) ? true : null;
    const ranks = obs.filter(o => o.kind === 'rank' && o.rank && isN(o.rank.position)).sort((a, b) => a.rank.position - b.rank.position);
    const lf = isF ? [] : obs.map(o => lintFind(o)).flat(); const lintBlock = lf.filter(x => x.sev === 'block').length, lintWarn = lf.filter(x => x.sev === 'warn' || x.sev === 'fix').length;
    const zipOffices = c.offices.map(o => ZI[o.zip] ? ZI[o.zip].lawoffices : null).filter(isN);
    return { key, name: c.name, isFirm: isF, tier: c.tier, counties: c.counties, lines: c.lines, offices: c.offices, lawyers: c.lawyers, domain: c.domain, cov: isF ? { share: c.counties.length ? 1 : null, filingShare: c.counties.length ? 1 : null, covered: c.counties, of: c.counties.length } : coverage(c), lov: isF ? { share: c.lines.length ? 1 : null, both: c.lines, of: c.lines.length } : lineOverlap(c), score: sd.score, live: sd.live, platforms: sd.platforms, reviews: rv, fees, freeConsult, spanish, bestRank: ranks[0] ? ranks[0].rank : null, lintBlock, lintWarn, lintTitles: [...new Set(lf.filter(x => x.sev !== 'info').map(x => x.title))], zipOffices: zipOffices.length ? sum(zipOffices) : null, lastChecked: c.lastChecked || '', certs: isF && typeof FIRM !== 'undefined' ? FIRM.certs() : [] };
  }
  const yn = v => v === true ? 'yes' : v === false ? 'no' : 'not on record';
  function compare(keys) {
    const ps = [FIRM_KEY].concat((keys || []).filter(k => comp(k)).slice(0, 4)).map(profileOf).filter(Boolean);
    const cn = fs => fs.map(f => CI[f] ? CI[f].name : f);
    const rows = [
      ['Tier', p => p.isFirm ? 'your firm' : TIERS[p.tier] || p.tier],
      ['Counties served', p => p.counties.length ? `${p.counties.length}: ${cn(p.counties).slice(0, 5).join(', ')}${p.counties.length > 5 ? ' and more' : ''}` : 'none recorded'],
      ['Your counties covered', p => p.cov.share == null ? 'set your counties' : `${P(p.cov.share, 0)} (${p.cov.covered.length} of ${p.cov.of})`],
      ['Private family filings they reach in your counties', p => p.cov.filingShare == null ? 'n/a' : P(p.cov.filingShare, 0)],
      ['Service lines', p => p.lines.length ? `${p.lines.length}: ${p.lines.map(lineShort).slice(0, 5).join('; ')}${p.lines.length > 5 ? ' and more' : ''}` : 'none recorded'],
      ['Your lines they also sell', p => p.lov.share == null ? 'set your lines' : `${P(p.lov.share, 0)} (${p.lov.both.length} of ${p.lov.of})`],
      ['Offices', p => p.offices.length ? `${p.offices.length}: ${[...new Set(p.offices.map(o => o.city).filter(Boolean))].join(', ') || 'no city'}` : 'none recorded'],
      ['Law offices in their office ZIPs (CBP 2023)', p => p.zipOffices == null ? 'n/a' : N(p.zipOffices)],
      ['Lawyers recorded', p => p.lawyers.length ? N(p.lawyers.length) : 'none'],
      ['Board certification on record', p => p.isFirm ? (p.certs.length ? p.certs.join('; ') : 'none in the profile') : 'check the TBLS link'],
      ['Rating and reviews (latest)', p => p.reviews.latest ? `${p.reviews.latest.rating != null ? N(p.reviews.latest.rating, 1) + ' stars, ' : ''}${N(p.reviews.latest.count)} reviews${p.reviews.latest.date ? ' on ' + fmtDate(p.reviews.latest.date) : ''}` : 'no snapshot'],
      ['Review velocity', p => p.reviews.velocity == null ? 'needs two snapshots 14 days apart' : `${N(p.reviews.velocity, 1)} a month`],
      ['Activity score', p => p.isFirm && !p.live ? `${p.score} (your own logged activity)` : String(p.score)],
      ['Live ads on record', p => `${N(p.live)}${p.platforms.length ? ' on ' + p.platforms.map(x => PLAT_SHORT[x] || x).join(', ') : ''}`],
      ['Fees advertised', p => p.fees.length ? p.fees.slice(0, 4).map(x => `${x.line ? lineShort(x.line) + ' ' : ''}${$$$(x.price)}`).join('; ') : 'none on record'],
      ['Free consultation', p => yn(p.freeConsult)],
      ['Spanish', p => yn(p.spanish)],
      ['Best ranking check', p => p.bestRank ? `#${p.bestRank.position} for "${p.bestRank.query}" (${RANK_WHERE[p.bestRank.where] || p.bestRank.where})` : 'none logged'],
      ['Logged copy that trips a rule', p => p.isFirm ? 'screen your copy in module 11' : p.lintBlock || p.lintWarn ? `${N(p.lintBlock)} would block, ${N(p.lintWarn)} to review: ${p.lintTitles.slice(0, 3).join('; ')}` : 'none found'],
      ['Last checked', p => p.isFirm ? 'n/a' : p.lastChecked ? fmtDate(p.lastChecked) : 'never']
    ];
    return { cols: ps.map(p => ({ key: p.key, name: p.name, isFirm: p.isFirm })), rows: rows.map(([label, f]) => ({ label, values: ps.map(f) })), profiles: ps };
  }
  /* ---------- digest ---------- */
  function digest() {
    const st = stats(); const out = []; const active = list(); const ctx = context();
    if (!active.length) { out.push('The roster is empty. Severance ships no competitor list: add the firms you meet in consultations, in court and on the results page, or paste a list, and the scores, links and comparisons fill in.'); }
    else out.push(`${N(active.length)} ${active.length === 1 ? 'competitor' : 'competitors'} on the roster${st.archived ? `, ${N(st.archived)} archived` : ''}; ${N(st.n)} observations of competitors logged${st.lastObs ? `, the latest dated ${fmtDate(st.lastObs)}` : ''}.`);
    if (ctx.counties.length) out.push(`Your ${N(ctx.counties.length)} ${ctx.counties.length === 1 ? 'county has' : 'counties have'} ${N(ctx.offices)} law offices in County Business Patterns 2023 and ${N(ctx.filings)} private family filings a year, ${N(ctx.fpo, 1)} filings per office against ${N(ctx.stateFpo, 1)} statewide. You track ${N(ctx.tracked)} competitors serving them.`);
    else out.push('Set the counties you serve in the firm profile (the Firm button) to compare the roster against the law office counts and filings there.');
    if (st.live) { const tops = Object.entries(st.byComp).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${esc((comp(k) || { name: k.replace(/^\?/, '') }).name)} (${n})`); out.push(`${N(st.live)} ads are on record as live${st.byPlat.meta ? `, ${N(st.byPlat.meta)} on Meta` : ''}${st.byPlat.google ? `, ${N(st.byPlat.google)} on Google Search` : ''}${st.byPlat.lsa ? `, ${N(st.byPlat.lsa)} in Local Services` : ''}. Most live ads: ${tops.join(', ')}.`); }
    else if (active.length) out.push('No competitor ad is logged as live yet. Open the library links in the sweep planner and log what you see.');
    const flats = st.prices.filter(p => ['flat', 'price'].includes(p.type) && p.line); if (flats.length) { const byL = {}; flats.forEach(p => { (byL[p.line] = byL[p.line] || []).push(p.price); }); const parts = Object.entries(byL).sort((a, b) => b[1].length - a[1].length).slice(0, 3).map(([l, v]) => { const s = v.slice().sort((a, b) => a - b); return `${lineShort(l)} median ${$$$(s[Math.floor((s.length - 1) / 2)])} (${s.length})`; }); out.push(`Fees advertised by line: ${parts.join('; ')}.`); }
    const fc = st.byOffer.consult_free || 0; if (fc) out.push(`${N(fc)} observations advertise a free consultation${typeof FIRM !== 'undefined' && FIRM.get().consult ? (FIRM.get().consult.free ? '; your profile offers one too.' : `; your profile charges ${$$$(+FIRM.get().consult.fee || 0)}.`) : '.'}`);
    const hooks = Object.entries(st.byHook).filter(([k]) => k !== 'other').sort((a, b) => b[1] - a[1]).slice(0, 3); if (hooks.length) out.push(`The most common hooks on record: ${hooks.map(([k, v]) => `${k} (${v})`).join(', ')}.`);
    const lines = Object.entries(st.byLine).sort((a, b) => b[1] - a[1]).slice(0, 3); if (lines.length) out.push(`Lines most often advertised: ${lines.map(([k, v]) => `${lineName(k)} (${v})`).join(', ')}.`);
    if (st.lints) out.push(`${N(st.lints)} logged entries carry a claim the compliance rules flag (${N(st.blocks)} would block if the firm made them). Read them as positioning: what your own copy must not say, and the accurate statement that sets it apart.`);
    if (st.unmatched) out.push(`${N(st.unmatched)} entries are not matched to a roster competitor; assign them in the timeline.`);
    const sd = S.settings.staleDays || 14; const stale = active.filter(c => !c.lastChecked || daysAgo(c.lastChecked) > sd).length; if (active.length) out.push(stale ? `${N(stale)} of ${N(active.length)} competitors ${stale === 1 ? 'has' : 'have'} not been checked in ${sd} days.` : `Every competitor has been checked in the last ${sd} days.`);
    return out;
  }
  /* ---------- exports ---------- */
  function csv() { return toCSV(CSV_H, guardRows(S.obs.map(toRow)), `Competitor Watch ledger, Severance module 24, exported ${today()}. Every row is an observation logged in this browser or imported; none ships with Severance.`); }
  function json() { const s = JSON.parse(JSON.stringify(S)); s.settings.token = ''; return JSON.stringify(Object.assign({ severance_watch: 1, exported: today(), atlas: 'Severance, module 24 Competitor Watch' }, s), null, 1); }
  function rosterRow(c) { const sd = scoreDetail(c); const rv = reviews(c.key); const cv = coverage(c); return [c.key, c.name, c.domain, c.tier, c.counties.map(f => CI[f] ? CI[f].name : f).join('; '), c.counties.join(' '), c.lines.join('; '), c.offices.map(officeStr).join('; '), c.lawyers.map(lawyerStr).join('; '), c.meta_page_id, c.google_advertiser_id, c.aliases, c.notes, c.archived ? 'yes' : '', c.created, c.lastChecked, sd.score, sd.live, sd.n, rv.latest ? rv.latest.count : '', rv.latest && rv.latest.rating != null ? rv.latest.rating : '', rv.velocity == null ? '' : rv.velocity.toFixed(1), cv.share == null ? '' : (cv.share * 100).toFixed(0) + '%', LINKS.metaKw(c.name), c.domain ? LINKS.googleDomain(c.domain) : '', LINKS.barSearch(c.name), LINKS.tblsForm(), LINKS.gMaps(c.name, placeOf(c))]; }
  function rosterCSV() { return toCSV(ROSTER_H, guardRows(S.comps.map(rosterRow)), `Competitor Watch roster, Severance module 24, exported ${today()}. Import this file to restore or share the roster; scores and links are recomputed on import.`); }
  const ROSTER_TEMPLATE = () => toCSV(['name', 'domain', 'tier', 'counties', 'lines', 'offices', 'lawyers', 'meta_page_id', 'google_advertiser_id', 'aliases', 'notes'], [], 'Roster template for Competitor Watch. One competitor per row. tier: direct, adjacent, referral or legalaid. counties: county names separated by semicolons.\nlines: service line names or keys (div_k, div_nk, sapcr, mod, enf, po, ivd, adopt, cps, prenup, high, mil, gray) separated by semicolons.\noffices: street, city, TX ZIP; separate several offices with semicolons. lawyers: names, optionally with the bar number in parentheses, separated by semicolons.');
  const SWEEP_H = ['competitor', 'competitor_key', 'domain', 'tier', 'counties', 'last_checked', 'days_since', 'live_ads_on_record', 'meta_ad_library_by_name', 'meta_ad_library_page', 'google_transparency_by_domain', 'google_transparency_advertiser', 'state_bar_search', 'tbls_search', 'google_maps', 'google_reviews', 'county_search'];
  function sweepRows(keys) { return (keys ? keys.map(comp).filter(Boolean) : list()).map(c => [c.name, c.key, c.domain, c.tier, c.counties.map(f => CI[f] ? CI[f].name : f).join('; '), c.lastChecked || '', c.lastChecked ? Math.max(0, Math.round(daysAgo(c.lastChecked))) : '', forComp(c.key).filter(isLiveAd).length, LINKS.metaKw(c.name), c.meta_page_id ? LINKS.metaPage(c.meta_page_id) : '', c.domain ? LINKS.googleDomain(c.domain) : '', c.google_advertiser_id ? LINKS.googleAdv(c.google_advertiser_id) : '', LINKS.barSearch(c.name), LINKS.tblsForm(), LINKS.gMaps(c.name, placeOf(c)), LINKS.gReviews(c.name), c.counties[0] && CI[c.counties[0]] ? LINKS.gCounty(CI[c.counties[0]].name) : '']); }
  function sweepCSV() { return toCSV(SWEEP_H, guardRows(sweepRows()), `Weekly sweep, Severance module 24, exported ${today()}. Open each link, log what you see, mark the competitor checked.`); }
  function compareCSV(keys) { const c = compare(keys); return toCSV(['measure'].concat(c.cols.map(x => x.name)).map(csvGuard), guardRows(c.rows.map(r => [r.label].concat(r.values))), `Competitor comparison, Severance module 24, ${today()}. Competitor values come from the roster and the observations logged in this browser.`); }
  function settings() { return S.settings; }
  function setSettings(p) { Object.assign(S.settings, p || {}); save('settings'); }
  return {
    KEY, FIRM_KEY, TIERS, KINDS, PLATFORMS, PLAT_SHORT, FORMATS, STATUSES, OFFERS, HOOKS, RANK_WHERE, LINKS, API_FIELDS, CSV_H, ROSTER_H, SWEEP_H,
    get state() { return S; }, get obs() { return S.obs; }, list, get: comp, add, addMany, update, archive, remove, setChecked, setIds,
    observe, obsUpdate, obsRemove, obsAddMany, forComp, blankObs, blankComp, normComp, matchComp, compLinks, placeOf,
    score, scoreDetail, reviews, coverage, lineOverlap, compare, profileOf, claims, positionFor, lintFind, stats, weekly, activeAds, timeline, obsCounties, countyCounts, rosterByCounty, activity, context, uncontested, digest,
    importText, importBackup, obsKey, safeUrl, csvGuard, unguard, parseAdText, parseRosterText, fromMetaApi, fromUrls, metaApiUrl, metaApiRun, canFetch,
    csv, json, rosterCSV, rosterTemplate: ROSTER_TEMPLATE, sweepRows, sweepCSV, compareCSV, settings, setSettings, clear, reload: load,
    isLive, isLiveAd, daysAgo, today, inferLine, inferOffer, inferHook, priceIn, isoFrom, domOf, countyByName, countiesFrom, linesFrom, parseOffice, officeStr, lawyerStr,
    setClock(d) { NOW = d || null; }
  };
})();
