'use strict';
/* Module 21: Site Forge. The Thermal Atlas module 09 rebuilt for a Texas family law firm.
   SFORGE plans the page set from the firm profile and the market data (counties by court filings, cities from the ZIP allocation),
   computes each page's values (V), has FCOPY write the blueprint, screens every text field with LINT, and hands the blueprint to
   FORGE_COMPILE (Elementor, semantic HTML, JSON-LD, preview). The module exposes publishPages(), publishAssets() and publishSite()
   for module 22 exactly as the Thermal Atlas module 09 does. Store keys: sev.forge.cfg, sev.forge.deployed, sev.forge.courts;
   photos and video live in IndexedDB (database sev-forge) so they survive a reload. */
const SFORGE = (() => {
  const C = FCOPY; const KL = C.KL; const LAW = C.LAW;
  const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MKEY = { '19100': 'dfw', '26420': 'hou', '41700': 'sat', '12420': 'aus', '21340': 'elp', '32580': 'rgv', '15180': 'rgv' };
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const num = v => isN(v) ? N(v) : null;
  const round = v => isN(v) ? N(Math.round(v)) : null;
  const throughISO = () => String(META.oca_through || '');
  const throughEn = () => fmtDateL(throughISO());
  const throughEs = () => { const m = throughISO().match(/^(\d{4})-(\d{2})/); return m ? `${MES[+m[2] - 1]} de ${m[1]}` : throughEn(); };
  const LOW = { div_k: 'divorce with children', div_nk: 'divorce', sapcr: 'child custody and paternity', mod: 'order modifications', enf: 'order enforcement', po: 'protective orders', ivd: 'child support', adopt: 'adoption', cps: 'CPS defense', prenup: 'premarital agreements', high: 'high asset divorce', mil: 'military divorce', gray: 'divorce later in life' };

  /* ---------- the city index: ZIP code tabulation areas grouped by city name within a metro ---------- */
  let CITYX = null;
  function cityIndex() {
    if (CITYX) return CITYX; CITYX = {};
    ZC.forEach(z => { if (!z.city || !z.msa) return; const key = z.msa + '|' + z.city; const a = z.acs || {}, al = z.alloc || {};
      const x = CITYX[key] || (CITYX[key] = { key, name: z.city, msa: z.msa, zips: [], byCounty: {}, pop: 0, married: 0, div: 0, divk: 0, sapcr: 0, po: 0, priv: 0, offices: 0, effW: 0, effT: 0, cx: 0, cy: 0, cw: 0 });
      x.zips.push(z.zip); x.pop += a.pop || 0; x.married += a.married || 0; x.div += al.div || 0; x.divk += al.div_k || 0; x.sapcr += al.sapcr || 0; x.po += al.po || 0; x.priv += al.priv || 0; x.offices += z.lawoffices || 0;
      if (z.paid && isN(z.paid.eff_pct)) { const w = Math.max(al.div || 0, 0.1); x.effW += z.paid.eff_pct * w; x.effT += w; }
      if (Array.isArray(z.cent)) { const w = Math.max(a.married || 0, 1); x.cx += z.cent[0] * w; x.cy += z.cent[1] * w; x.cw += w; }
      x.byCounty[z.county] = (x.byCounty[z.county] || 0) + (a.married || 0); });
    Object.values(CITYX).forEach(x => { x.county = Object.keys(x.byCounty).sort((a, b) => x.byCounty[b] - x.byCounty[a])[0]; x.eff = x.effT ? x.effW / x.effT : null; x.cent = x.cw ? [x.cx / x.cw, x.cy / x.cw] : null; x.zips.sort(); });
    return CITYX;
  }
  const effOfCounty = (() => { const m = {}; return f => { if (m[f] !== undefined) return m[f]; const zs = ZC.filter(z => z.county === f && z.paid && isN(z.paid.eff_pct)); m[f] = zs.length ? mean(zs.map(z => z.paid.eff_pct)) : null; return m[f]; }; })();
  const linesSold = () => FIRM.lines().filter(k => C.LINES[k]);
  const CMET = {
    div: ['Divorce filings, last 12 months', c => c.filings.ttm.div], divk: ['Divorces with children', c => c.filings.ttm.div_k], priv: ['Private family filings', c => c.filings.ttm.priv],
    po: ['Protective order cases', c => c.filings.ttm.po], modenf: ['Modifications and enforcements', c => (c.filings.ttm.mod || 0) + (c.filings.ttm.enf || 0)], married: ['Married adults', c => c.acs.married],
    lines: ['Filings in the firm\'s lines', c => sum(linesSold().map(k => { const n = LINE_META[k] ? LINE_META[k].cnt(c) : null; return isN(n) ? n : 0; }))],
    di: ['Dissolution Index', c => c.di], per_office: ['Private filings per law office', c => c.rates.filings_per_lawoffice], eff: ['ZIP efficiency, mean of the county ZIPs', c => effOfCounty(c.fips)]
  };
  const ZMET = { div: ['Expected divorce filings a year', x => x.div], priv: ['Expected private family filings', x => x.priv], married: ['Married adults', x => x.married], eff: ['ZIP efficiency, weighted mean', x => x.eff], per_office: ['Expected filings per law office', x => x.offices ? x.priv / x.offices : x.priv], pop: ['Population', x => x.pop] };

  function defaultCfg() {
    return {
      v: 1,
      site: { url: '', cms: '', email: '', entity: 'LegalService', form_provider: 'html', form_shortcode: '', form_action: '', cta_label: 'Request a consultation', cta_url: '#contact', template: 'default',
        trust: 'Responsible attorney {atty} | Office in {officeCity}, Texas | {consultShort}', about: '', video_url: '', testimonials: '', sticky: true, noindex_landing: true, guides_as_posts: false, globals: true,
        primary: '', accent: '', dark: '', font_heading: '', font_body: '', logo_url: '', hoursSchema: '', sameAs: '', live: '' },
      focus: { scope: 'firm', metro: '19100', counties: [], cmetric: 'div', nc: 6, cscope: 'rank', cpicks: [], zmetric: 'div', n: 8, minPop: 10000 },
      build: { home: true, about: true, attorneys: true, practice: true, faq: true, counties: true, cities: true, landing: true, es: true, guides: true, lines: null, landingLines: null, topics: C.GUIDES.filter(g => g.id !== 'timeline').map(g => g.id) },
      media: { assets: [], assign: {} }, edits: {}, removed: {}
    };
  }
  const site = cfg => { const F = FIRM.get(); return Object.assign({}, cfg.site, { url: cfg.site.url || F.url || '', email: cfg.site.email || F.intake_email || '', primary: cfg.site.primary || (F.colors || {}).primary, accent: cfg.site.accent || (F.colors || {}).accent, dark: cfg.site.dark || (F.colors || {}).dark }); };
  const activeLines = cfg => { const sold = linesSold(); const L = Array.isArray(cfg.build.lines) ? cfg.build.lines.filter(k => sold.includes(k)) : sold; return L; };
  const landingLines = cfg => { const sold = linesSold(); return Array.isArray(cfg.build.landingLines) ? cfg.build.landingLines.filter(k => sold.includes(k)) : sold.slice(0, 2); };
  const hasEs = () => (FIRM.get().languages || []).includes('es');

  /* ---------- markets: counties ranked by court filings, cities from the ZIP allocation ---------- */
  function candCounties(cfg) {
    const f = cfg.focus; const m = (CMET[f.cmetric] || CMET.div)[1]; const rank = list => list.filter(Boolean).slice().sort((a, b) => (m(b) || 0) - (m(a) || 0));
    if (f.scope === 'pick') return rank(f.counties.map(x => CI[x]));
    if (f.scope === 'metro') return rank((MSA[f.metro] ? MSA[f.metro].counties : []).map(x => CI[x])).slice(0, clamp(+f.nc || 6, 1, 254));
    if (f.scope === 'all') return rank(CTY).slice(0, clamp(+f.nc || 6, 1, 254));
    return rank(FIRM.counties().map(x => CI[x]));
  }
  function markets(cfg) {
    const counties = candCounties(cfg); const set = new Set(counties.map(c => c.fips)); const f = cfg.focus; const X = cityIndex();
    let cities;
    if (f.cscope === 'pick') cities = f.cpicks.map(k => X[k]).filter(Boolean);
    else { const m = (ZMET[f.zmetric] || ZMET.div)[1]; const cand = Object.values(X).filter(x => set.has(x.county) && x.pop >= (+f.minPop || 0));
      cities = cand.slice().sort((a, b) => (m(b) || 0) - (m(a) || 0)).slice(0, clamp(+f.n || 8, 0, 200));
      const oc = (FIRM.primary().city || '').trim().toLowerCase(); const home = cand.find(x => x.name.toLowerCase() === oc); if (home && !cities.includes(home)) cities.push(home); }
    return { counties, cities };
  }

  /* ---------- courthouses: the Metro Atlas files list the family courts; loaded on first use and remembered ---------- */
  const COURTS = Object.assign({}, store.get('sev.forge.courts', {}) || {}); const COURT_TRIED = {};
  function atlasObj(k) { const W = window.__SEV_ATLAS__ || {}; if (W[k]) return W[k]; const t = document.getElementById('atlas-' + k); if (t) { try { return JSON.parse(t.textContent); } catch (e) { return null; } } return null; }
  function harvest(k) { const a = atlasObj(k); if (!a || !Array.isArray(a.courts)) return false; a.courts.forEach(ct => { if (ct && ct.f && ct.n) COURTS['48' + ct.f] = { n: ct.n, a: ct.a || '' }; }); COURTS['_' + k] = 1; store.set('sev.forge.courts', COURTS); return true; }
  function needCourts(counties) { const ks = new Set(); counties.forEach(c => { const k = MKEY[c.msa]; if (k && !COURTS['_' + k] && !COURT_TRIED[k]) ks.add(k); }); return [...ks]; }
  function loadCourts(keys) {
    return Promise.all(keys.map(k => new Promise(res => { COURT_TRIED[k] = 1; if (harvest(k)) { res(true); return; }
      try { const s = document.createElement('script'); s.src = 'data/atlas-' + k + '.js'; s.onload = () => res(harvest(k)); s.onerror = () => res(false); document.head.appendChild(s); } catch (e) { res(false); } })));
  }

  /* ---------- template values ---------- */
  function areaCountiesText(cs) { const n = cs.map(c => c.name); if (!n.length) return 'Texas'; if (n.length === 1) return n[0] + ' County'; if (n.length <= 5) return C.listAnd(n) + ' counties'; return n.slice(0, 4).join(', ') + ' and ' + N(n.length - 4) + ' more counties'; }
  function baseVars(cfg, ms) {
    const F = FIRM.get(); const r = FIRM.responsible(); const o = FIRM.primary(); const cs = F.consult || {}; const lines = activeLines(cfg); const all = linesSold();
    const V = { state: 'Texas', brand: F.name || '[Firm name]', atty: r.name || '[Responsible attorney]', officeCity: o.city || '[Office city]', phone: FIRM.phone() || '[Phone]', founded: F.founded ? String(F.founded) : '' };
    V.attyBarClause = r.bar_no ? `, State Bar of Texas No. ${r.bar_no}` : '';
    V.attyCred = r.bar_no ? `Attorney, State Bar of Texas No. ${r.bar_no}` : 'Attorney licensed in Texas'; V.attyBio = r.bio || '';
    V.officeAddr = o.street ? `${o.street}, ${o.city || '[Office city]'}, Texas ${o.zip || ''}`.trim() : `${V.officeCity}, Texas`; V.officeLoc = o.street ? `${o.street}, ${o.city || '[Office city]'}, Texas` : `${V.officeCity}, Texas`;
    V.officeLine = o.street ? `Our primary office is at ${o.street}, ${o.city}, Texas ${o.zip || ''}.`.replace(/\s+\./, '.') : `Our primary office is in ${V.officeCity}, Texas.`;
    V.officeLineEs = o.street ? `Nuestra oficina principal está en ${o.street}, ${o.city}, Texas ${o.zip || ''}.`.replace(/\s+\./, '.') : `Nuestra oficina principal está en ${V.officeCity}, Texas.`;
    V.hours = o.hours || '';
    V.consultShort = cs.free ? 'Free consultation' : isN(+cs.fee) && +cs.fee > 0 ? `Consultation ${$$$(+cs.fee)}` : 'Consultation by appointment';
    V.consultLine = cs.free ? 'The first consultation is free.' : isN(+cs.fee) && +cs.fee > 0 ? `The consultation fee is ${$$$(+cs.fee)}.` : 'Consultations are by appointment.';
    V.consultShortEs = cs.free ? 'Consulta gratis' : isN(+cs.fee) && +cs.fee > 0 ? `Consulta ${$$$(+cs.fee)}` : 'Consulta con cita';
    V.consultLineEs = cs.free ? 'La primera consulta es gratis.' : isN(+cs.fee) && +cs.fee > 0 ? `La consulta cuesta ${$$$(+cs.fee)}.` : 'Las consultas son con cita.';
    V.virtualLine = cs.virtual ? 'Consultations are available by video or in person.' : '';
    V.paymentLine = F.payment ? `Payment options: ${F.payment}.` : '';
    const low = (lines.length ? lines : all).map(k => LOW[k]).filter(Boolean); if (low.includes('divorce with children') && low.includes('divorce')) { low.splice(low.indexOf('divorce with children'), 1); low[low.indexOf('divorce')] = 'divorce with and without children'; }
    V.lineList = low.length ? C.listAnd(low) : 'family law matters'; V.lineListCap = V.lineList.charAt(0).toUpperCase() + V.lineList.slice(1);
    const cts = ms ? ms.counties : []; V.areaCounties = areaCountiesText(cts);
    const cn = ms ? ms.cities.map(x => x.name).slice(0, 6) : []; V.areaLine = (o.city || cts.length) ? (cn.length ? `Clients across ${V.areaCounties}, including ${C.listAnd(cn)}, from our office in ${V.officeCity}.` : `Clients across ${V.areaCounties}, from our office in ${V.officeCity}.`) : '';
    V.through = throughEn(); V.throughEs = throughEs();
    const monthly = cts.length && cts.every(c => c.filings && c.filings.monthly); V.period = !cts.length || monthly ? `the 12 months through ${V.through}` : 'the latest 12 months each county reported';
    V.s_div = num(sum(CTY.map(c => c.filings.ttm.div || 0)));
    if (cts.length) { const t = k => sum(cts.map(c => c.filings.ttm[k] || 0));
      V.a_div = num(t('div')); V.a_divk = num(t('div_k')); V.a_divnk = num(t('div') - t('div_k')); V.a_sapcr = num(t('sapcr')); V.a_mod = num(t('mod')); V.a_enf = num(t('enf')); V.a_po = num(t('po')); V.a_ivd = num(t('ivd')); V.a_adopt = num(t('adopt')); V.a_cps = num(t('cps')); }
    const certs = FIRM.certs(); V.certs = certs.length ? certs.join('. ') + '.' : '';
    return V;
  }
  function countyVars(c, V, ms) {
    if (!c) return V; const f = c.filings || {}; const t = f.ttm || {}, pv = f.ttm_prev || {}; const monthly = !!(f.monthly && f.series);
    V.county = c.name; V.k_div = num(t.div); V.k_divk = num(t.div_k); V.k_divnk = isN(t.div) && isN(t.div_k) ? N(t.div - t.div_k) : null; V.k_sapcr = num(t.sapcr); V.k_po = num(t.po); V.k_mod = num(t.mod); V.k_enf = num(t.enf);
    V.k_modenf = isN(t.mod) && isN(t.enf) ? N(t.mod + t.enf) : null; V.k_ivd = num(t.ivd); V.k_cps = num(t.cps); V.k_adopt = num(t.adopt); V.k_priv = num(t.priv);
    V.k_div_prev = num(pv.div); V.k_sapcr_prev = num(pv.sapcr); V.k_mod_prev = num(pv.mod); V.k_enf_prev = num(pv.enf); V.k_po_prev = num(pv.po);
    V.k_change = c.rates && isN(c.rates.div_yoy) ? updown(c.rates.div_yoy, 0) : null;
    const yr = String(f.ttm_label || '').replace(/\D/g, '');
    V.k_when = monthly ? `in the 12 months through ${V.through}` : `in ${f.ttm_label || 'the latest year'}`;
    V.k_whenEs = monthly ? `los 12 meses hasta ${V.throughEs}` : `el año ${yr}`;
    V.k_whenShort = monthly ? `12 months to ${fmtDate(throughISO())}` : (yr || 'Latest year');
    if (monthly && f.series.p_div && f.series.p_div.length && isN(f.series.p_div[f.series.p_div.length - 1]) && isN(t.d_div)) {
      V.k_pending = N(f.series.p_div[f.series.p_div.length - 1]); V.k_disposed = N(t.d_div);
      V.k_pendingLine = `At the end of ${V.through}, ${V.k_pending} divorce cases were pending in ${c.name} County, and the courts disposed of ${V.k_disposed} ${V.k_when}.`;
    } else V.k_pendingLine = '';
    V.k_married = num(c.acs && c.acs.married); V.k_offices = num(c.rates && c.rates.lawoffices);
    const ct = COURTS[c.fips]; V.k_court = ct ? ct.n : ''; V.k_courtAddr = ct ? ct.a || '' : ''; V.k_courtLine = ct ? `In ${c.name} County, family cases are heard at the ${ct.n}${ct.a ? ', ' + ct.a : ''}.` : '';
    V.k_hist = Object.keys(f.hist || {}).filter(y => f.hist[y] && f.hist[y].months === 12 && isN(f.hist[y].div)).sort().map(y => [y, N(f.hist[y].div), num(f.hist[y].div_k) || '']);
    const X = cityIndex(); const inPlan = (ms ? ms.cities : []).filter(x => x.county === c.fips);
    const top = inPlan.length ? inPlan : Object.values(X).filter(x => x.county === c.fips).sort((a, b) => b.married - a.married).slice(0, 6);
    V.countyCities = C.listAnd(top.slice(0, 6).map(x => x.name));
    V.k_cities = inPlan.map(x => [x.name, N(Math.round(x.div)), N(Math.round(x.married)), N(x.zips.length)]);
    return V;
  }
  function cityVars(x, V, ms) {
    V.city = x.name; V.cityFull = x.name + ', TX'; V.c_div = round(x.div); V.c_married = round(x.married); V.c_sapcr = round(x.sapcr); V.c_po = round(x.po); V.c_pop = round(x.pop);
    V.c_zips = x.zips.length > 8 ? x.zips.slice(0, 7).join(', ') + ' and ' + N(x.zips.length - 7) + ' others' : C.listAnd(x.zips); V.c_zipCount = N(x.zips.length);
    const X = cityIndex(); const d = y => x.cent && y.cent ? Math.hypot(x.cent[0] - y.cent[0], x.cent[1] - y.cent[1]) : 1e9;
    let near = (ms ? ms.cities : []).filter(y => y.key !== x.key && y.msa === x.msa).sort((a, b) => d(a) - d(b)).slice(0, 4);
    if (near.length < 2) near = Object.values(X).filter(y => y.key !== x.key && y.msa === x.msa && y.pop >= 10000).sort((a, b) => d(a) - d(b)).slice(0, 4);
    V.nearby = C.listAnd(near.map(y => y.name));
    V.officeWhere = (V.officeCity || '').toLowerCase() === x.name.toLowerCase() ? `our office here in ${x.name}` : `our office in ${V.officeCity}`;
    return V;
  }
  function attyVars(a, V) {
    a = a || {}; V.at_name = a.name || '[Attorney name]'; V.at_bar = a.bar_no || ''; V.at_since = a.since ? String(a.since) : ''; V.at_bio = a.bio || '';
    V.at_cert = a.tbls ? `${a.name}, Board Certified, ${a.tbls}, Texas Board of Legal Specialization` : '';
    V.at_barClause = a.bar_no ? `, bar number ${a.bar_no}` : ''; V.at_sinceClause = a.since ? `, licensed since ${a.since}` : ''; V.at_sinceSentence = a.since ? ` Licensed in Texas since ${a.since}.` : '';
    return V;
  }
  function varsFor(p, cfg, ms) {
    const V = baseVars(cfg, ms); const F = FIRM.get(); const X = cityIndex();
    if (p.city && X[p.city]) { countyVars(CI[X[p.city].county], V, ms); cityVars(X[p.city], V, ms); }
    else if (p.fips && CI[p.fips]) { countyVars(CI[p.fips], V, ms); V.city = V.county + ' County'; V.cityFull = V.city + ', TX'; V.officeWhere = `our office in ${V.officeCity}`; }
    else { V.city = V.officeCity; V.cityFull = V.officeCity + ', TX'; V.officeWhere = `our office in ${V.officeCity}`; }
    if (p.kind === 'attorney') attyVars((F.attorneys || [])[p.atty], V);
    if (p.line) { const fee = (F.fees || {})[p.line]; V.fee = isN(+fee) && +fee > 0 && fee !== null && fee !== '' ? $$$(+fee) : ''; }
    return V;
  }

  /* ---------- the plan ---------- */
  function plan(cfg) {
    const pages = []; const B = cfg.build; const ms = markets(cfg); const F = FIRM.get();
    const add = (kind, o) => { const p = Object.assign({ kind, lang: 'en' }, o || {}); p.id = [kind, p.line || '', p.city || '', p.fips || '', p.topic || '', p.lang, p.atty != null ? p.atty : ''].join('|'); pages.push(p); return p; };
    if (B.home) add('home'); if (B.about) add('about');
    if (B.attorneys) (F.attorneys || []).forEach((a, i) => { if (a.name) add('attorney', { atty: i }); });
    if (B.practice) activeLines(cfg).forEach(l => add('practice', { line: l }));
    if (B.faq) add('faq');
    if (B.counties) ms.counties.forEach(c => add('county', { fips: c.fips }));
    if (B.cities) ms.cities.forEach(x => add('city', { city: x.key, fips: x.county }));
    if (B.landing) { const targets = ms.cities.length ? ms.cities.map(x => ({ city: x.key, fips: x.county })) : ms.counties.map(c => ({ fips: c.fips }));
      targets.forEach(t => landingLines(cfg).forEach(l => { add('landing', Object.assign({ line: l }, t)); if (B.es && hasEs()) add('landing', Object.assign({ line: l, lang: 'es' }, t)); })); }
    if (B.guides) { const G = C.GUIDES.filter(g => (B.topics || []).includes(g.id));
      G.filter(g => g.scope === 'state').forEach(g => add('guide', { topic: g.id }));
      G.filter(g => g.scope === 'county').forEach(g => ms.counties.forEach(c => { const V = varsFor({ kind: 'guide', fips: c.fips }, cfg, ms); if (!g.need || g.need(V)) add('guide', { topic: g.id, fips: c.fips }); })); }
    const seen = {}; pages.forEach(p => { const V = varsFor(p, cfg, ms); Object.assign(p, C.describe(p, V)); if (cfg.edits[p.id]) Object.assign(p, cfg.edits[p.id]); let s = p.slug, n = 2; while (seen[s]) s = p.slug + '-' + (n++); seen[s] = 1; p.slug = s; });
    return { pages: pages.filter(p => !cfg.removed[p.id]), removed: pages.filter(p => cfg.removed[p.id]), markets: ms };
  }

  /* ---------- live URLs, the only internal link targets ---------- */
  function anchorFrom(path) {
    if (path === '/') return 'Home';
    const seg = path.replace(/\/+$/, '').split('/').pop() || '';
    const t = decodeURIComponent(seg).replace(/\.[a-z]{2,4}$/i, '').replace(/[-_]+/g, ' ').trim();
    const w = t.split(/\s+/).map(x => ({ tx: 'TX', cps: 'CPS', dfps: 'DFPS', sapcr: 'SAPCR', qdro: 'QDRO', faq: 'FAQ', pllc: 'PLLC', llp: 'LLP', pc: 'PC' }[x.toLowerCase()] || x.toLowerCase()));
    const s = w.join(' '); return C.house(s.charAt(0).toUpperCase() + s.slice(1));
  }
  function parseLive(text, siteUrl) {
    const out = [], notes = []; if (!text || !text.trim()) return { items: out, notes, index: false };
    const host = hostOf(siteUrl); const locs = [...text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => ({ url: m[1] }));
    const raw = locs.length ? locs : text.split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => { const m = l.split('|').map(s => s.trim()); return m.length > 1 ? { anchor: m[0], url: m[1] } : { url: m[0] }; });
    let other = 0, xml = 0; const seen = new Set();
    raw.forEach(it => { let U; try { U = new URL(it.url.replace(/&amp;/g, '&'), siteUrl || 'https://example.com'); } catch (e) { return; }
      if (host && U.hostname.replace(/^www\./, '') !== host) { other++; return; }
      let path = U.pathname || '/'; if (/\.xml$/i.test(path)) { xml++; return; } if (/\.(jpe?g|png|gif|webp|svg|pdf|mp4|webm|css|js)$/i.test(path)) return;
      if (!/\.[a-z0-9]{2,5}$/i.test(path) && !path.endsWith('/')) path += '/'; if (seen.has(path)) return; seen.add(path);
      out.push({ path, url: path, anchor: it.anchor ? C.house(it.anchor) : anchorFrom(path) }); });
    if (other) notes.push(`${other} URLs on another host ignored`); if (xml) notes.push(`${xml} child sitemaps listed: paste the page and post sitemaps they point to`);
    return { items: out, notes, index: xml > 0 && !out.length };
  }
  const liveHas = (live, path) => live.items.some(l => l.path === path);
  function bestFor(live, line, cityTok, exclude) { const tok = (C.LINES[line] || {}).tok || []; let best = null, bs = 0; live.items.forEach(l => { if (exclude && exclude.has(l.path)) return; if (l.path === '/') return; const p = l.path.toLowerCase(); let s = 0; tok.forEach(t => { if (p.includes(t)) s += 2; }); if (cityTok && p.includes(cityTok)) s += 1; if (s > bs) { bs = s; best = l; } }); return bs >= 2 ? best : null; }
  function linksFor(p, live, self, cfg) {
    if (!live.items.length) return [];
    const out = []; const used = new Set([self]); const push = l => { if (l && !used.has(l.path) && out.length < 6) { used.add(l.path); out.push({ anchor: l.anchor, url: l.path }); } };
    const X = cityIndex(); const cityTok = p.city && X[p.city] ? slug(X[p.city].name) : p.fips && CI[p.fips] ? slug(CI[p.fips].name) : null;
    if (p.kind !== 'home' && p.kind !== 'landing') push(live.items.find(l => l.path === '/'));
    if (p.kind === 'landing') return out;
    const lines = p.line ? [p.line].concat((C.LINES[p.line] || {}).related || []) : p.kind === 'guide' ? ({ filings: ['div_k', 'div_nk'], timeline: ['div_nk', 'div_k'], support: ['ivd', 'mod', 'enf'], property: ['div_nk', 'high'], custody: ['sapcr', 'div_k'], maintenance: ['div_nk', 'gray'], po: ['po'], modify: ['mod', 'enf'] }[p.topic] || ['div_k']) : activeLines(cfg).slice(0, 4);
    if (cityTok) live.items.filter(l => l.path.toLowerCase().includes(cityTok)).slice(0, 2).forEach(push);
    lines.forEach(l => push(bestFor(live, l, cityTok, used)));
    return out;
  }

  /* ---------- schema, media and the blueprint ---------- */
  function baseUrl(cfg) { return String(site(cfg).url || 'https://www.example.com').replace(/\/+$/, ''); }
  function entity(cfg, ms) {
    const F = FIRM.get(); const o = FIRM.primary(); const S = site(cfg);
    const e = { '@type': S.entity || 'LegalService', name: F.name || '[Firm name]' }; if (F.legal_name) e.legalName = F.legal_name;
    const d = String(F.phone || o.phone || '').replace(/\D/g, ''); if (d.length === 10) e.telephone = '+1' + d; else if (d.length === 11 && d[0] === '1') e.telephone = '+' + d; else if (d) e.telephone = F.phone;
    if (S.email) e.email = S.email;
    if (o.street || o.city) e.address = { '@type': 'PostalAddress', streetAddress: o.street || undefined, addressLocality: o.city || undefined, addressRegion: 'TX', postalCode: o.zip || undefined, addressCountry: 'US' };
    if (S.hoursSchema) e.openingHours = S.hoursSchema;
    const same = Object.values(F.social || {}).filter(v => /^https?:/.test(String(v))).concat(String(S.sameAs || '').split(/[\s,]+/).filter(v => /^https?:/.test(v))); if (same.length) e.sameAs = [...new Set(same)];
    if (F.founded) e.foundingDate = String(F.founded);
    const area = (ms ? ms.counties : []).map(c => ({ '@type': 'AdministrativeArea', name: c.name + ' County, Texas' })).concat((ms ? ms.cities : []).map(x => ({ '@type': 'City', name: x.name + ', Texas' }))); if (area.length) e.areaServed = area;
    const ks = activeLines(cfg).map(k => C.fill(C.LINES[k].nm, {})); if (ks.length) e.knowsAbout = ks;
    return e;
  }
  function testimonials(cfg) { const t = String(cfg.site.testimonials || '').trim(); if (!t) return null; const items = []; t.split(/\n+/).forEach(line => { const m = line.split('|').map(x => x.trim()); if (m[0]) items.push({ quote: m[0], name: m[1] || '', role: m[2] || '', rating: m[3] ? Number(m[3]) : undefined }); }); return items.length ? items : null; }
  function mediaSpec(p, cfg, V, assets) {
    const S = cfg.site; const F = FIRM.get(); const m = {}; const asg = cfg.media.assign || {}; const pick = key => { const id = asg[key]; return id ? (assets || []).find(x => x.id === id) : null; };
    const brand = V.brand; const L = p.line ? C.LINES[p.line] : null;
    const a = pick('page:' + p.id) || pick('city:' + (p.city || '')) || pick('county:' + (p.fips || '')) || pick('kind:' + p.kind) || pick('default');
    const alt = C.house(p.kind === 'city' || p.kind === 'landing' ? `${brand}, family law for ${V.city} clients` : p.kind === 'practice' ? `${C.fill(L.nm, V)}, ${brand}` : p.kind === 'county' ? `${brand}, family law across ${V.county} County, Texas` : p.kind === 'attorney' ? `${V.at_name}, ${brand}` : `${brand}, family law in ${V.officeCity}, Texas`);
    const q = p.kind === 'city' || p.kind === 'landing' ? V.city + ' family law' : p.kind === 'practice' ? L.short : p.kind === 'county' ? V.county + ' county' : 'family law office';
    if (p.kind !== 'guide' && p.kind !== 'faq' && p.kind !== 'attorney') m.hero = { source: a ? 'assets/' + a.file : 'library:' + q, alt, kind: 'image', priority: true };
    if (p.kind === 'attorney') { const at = (F.attorneys || [])[p.atty] || {}; const h = pick('atty:' + p.atty); m.headshot = { source: h ? 'assets/' + h.file : 'library:' + (at.name || 'attorney'), alt: C.house(`${at.name || 'Attorney'}, ${brand}`), kind: 'image', priority: true }; }
    const ri = FIRM.get().responsible || 0; const ra = FIRM.responsible(); if (ra.name && p.lang !== 'es') { const au = pick('atty:' + ri); m.author = { source: au ? 'assets/' + au.file : 'library:' + ra.name, alt: C.house(`${ra.name}, ${brand}`), kind: 'image' }; }
    if (p.kind === 'home' || p.kind === 'about') (F.attorneys || []).forEach((at, i) => { const h = at.name && pick('atty:' + i); if (h) m['atty' + i] = { source: 'assets/' + h.file, alt: C.house(`${at.name}, ${brand}`), kind: 'image' }; });
    if (S.video_url && (p.kind === 'home' || p.kind === 'practice')) m.explainer = { source: S.video_url, alt: C.house(`${brand}, what a consultation looks like`), kind: 'video' };
    return m;
  }
  function featuresFor(cfg, V, live, pages) {
    return activeLines(cfg).slice(0, 9).map(k => { const L = C.LINES[k]; const pp = (pages || []).find(q => q.kind === 'practice' && q.line === k); const own = pp && liveHas(live, '/' + pp.slug + '/') ? { path: '/' + pp.slug + '/' } : bestFor(live, k, null, null);
      return { title: C.fill(L.nm, V), text: C.firstSentence(C.fill(L.lede, V)), url: own ? own.path : undefined, link: own ? 'Read more' : undefined }; });
  }
  function blueprint(p, cfg, pages, live, ms, assets) {
    const V = varsFor(p, cfg, ms); const S = site(cfg); const F = FIRM.get(); const media = mediaSpec(p, cfg, V, assets);
    const firm = Object.assign({}, F, { county_names: FIRM.counties().map(cname), city_names: ms.cities.map(x => x.name) });
    const attyPage = i => (pages || []).find(q => q.kind === 'attorney' && q.atty === i);
    const cards = (F.attorneys || []).map((a, i) => { if (!a.name) return null; const ap = attyPage(i); const o = { name: a.name }; if (ap && liveHas(live, '/' + ap.slug + '/')) o.url = '/' + ap.slug + '/'; if (media['atty' + i]) o.media = 'atty' + i; return o; }).filter(Boolean);
    let langAlt = null; if (p.kind === 'landing') { const twin = (pages || []).find(q => q.kind === 'landing' && q.line === p.line && q.city === p.city && q.fips === p.fips && q.lang !== p.lang); if (twin && liveHas(live, '/' + twin.slug + '/')) langAlt = { url: '/' + twin.slug + '/', lang: twin.lang }; }
    const ctx = { V, site: S, firm, lines: activeLines(cfg), internal: linksFor(p, live, '/' + p.slug + '/', cfg), crumbs: liveHas(live, '/'), media, entity: entity(cfg, ms), extraSchema: [],
      features: featuresFor(cfg, V, live, pages), testimonials: testimonials(cfg), today: todayISO(), attorneys: cards, counties: ms.counties.map(c => c.name), langAlt };
    if (p.kind === 'attorney') { const a = (F.attorneys || [])[p.atty] || {}; const ap = attyPage(p.atty); ctx.author = { name: a.name, credentials: a.bar_no ? `Attorney, State Bar of Texas No. ${a.bar_no}` : 'Attorney licensed in Texas', bio: a.bio || '' };
      ctx.attorney = { name: a.name, title: 'Attorney', bar_no: a.bar_no || undefined, tbls: a.tbls || undefined, since: a.since || undefined, bio: a.bio || undefined, url: ap ? '/' + ap.slug + '/' : undefined }; }
    const bp = C.blueprint(p, ctx); bp._v = V; return bp;
  }

  /* ---------- checks: LINT on every visible field, the page as a whole, the compiler and the lengths ---------- */
  function checks(bp, r) {
    const I = []; const add = (id, sev, where, ev, msg, cite, fix) => { if (!I.some(x => x.id === id && x.where === where)) I.push({ id, sev, where, ev: ev || '', msg, cite: cite || '', fix: fix || '' }); };
    const lang = /^es/.test(bp.page.language || '') ? 'es' : 'en'; const txt = C.visibleText(bp);
    if (typeof LINT !== 'undefined') {
      txt.forEach(([where, t]) => { let res; try { res = LINT.screen(t, { kind: 'page', footer: false, lang }); } catch (e) { res = { findings: [] }; } (res.findings || []).forEach(f => add(f.id, f.sev, where, f.hit, f.title, f.rule, f.fix ? `${f.fix.from} to ${f.fix.to}` : f.why)); });
      /* the compiled page as Publish screens it: title, meta and the HTML, with the form, the attorney cards, the court facts and the disclaimer */
      let all; try { all = LINT.screen((bp.page.title || '') + '\n' + (bp.page.meta_description || '') + '\n' + (r.html || ''), { kind: 'page', html: true, lang }); } catch (e) { all = { findings: [] }; }
      (all.findings || []).filter(f => f.id === 'r702a' || !I.some(x => x.id === f.id)).forEach(f => add(f.id, f.sev, 'compiled page', f.hit, f.title, f.rule, f.why));
    } else add('LINT', 'warn', 'page', '', 'The compliance engine is not loaded; the copy was not screened', '', '');
    const iss = Array.isArray(r.issues) ? r.issues : (r.lint || r.warnings || []).map(msg => ({ sev: /^BLOCK/.test(msg) ? 'block' : /^MEDIA/.test(msg) ? 'note' : 'warn', msg }));
    iss.forEach((x, li) => { const s = String(x.msg || ''); const links = /no internal links/.test(s); const media = /^MEDIA/.test(s); const msg = links ? 'No internal links yet: paste the live sitemap in step 4 and links are drawn from it' : media ? s.replace(/^MEDIA: /, 'Media ').replace(/\.\s+Resolved at deploy[\s\S]*$/i, '') + ', resolved at deploy' : s.replace(/^BLOCK: /, '');
      add('FORGE', x.sev === 'block' ? 'block' : links || media ? 'note' : x.sev === 'info' ? 'info' : x.sev === 'note' ? 'note' : 'warn', 'compiler ' + (li + 1), '', msg, '', ''); });
    if ((bp.page.h1 || '').length > 70) add('LEN', 'warn', 'seo.h1', bp.page.h1.length + ' chars', 'H1 over 70 characters', '', 'Shorten it in the studio.');
    if ((bp.page.title || '').length > 60) add('LEN', 'warn', 'seo.title', bp.page.title.length + ' chars', 'Title over 60 characters', '', 'Shorten it in the studio.');
    if ((bp._missing || []).length) add('VARS', 'warn', 'template', bp._missing.join(', '), 'Template values without data on this page were dropped; read the page for gaps', '', 'Fill the firm profile or pick a place with the data.');
    const ORDER = ['block', 'fix', 'warn', 'info', 'note']; const n = s => I.filter(x => x.sev === s).length;
    return { issues: I.sort((x, y) => ORDER.indexOf(x.sev) - ORDER.indexOf(y.sev)), block: n('block'), fix: n('fix'), warn: n('warn') + n('fix'), info: n('info'), note: n('note') + n('info'), pass: n('block') === 0 };
  }
  const wordCount = bp => C.wordCount(bp);
  return { KL, CMET, ZMET, MKEY, defaultCfg, site, markets, plan, blueprint, checks, wordCount, parseLive, anchorFrom, varsFor, baseVars, countyVars, cityVars, entity, cityIndex, activeLines, landingLines, linesSold, hasEs, needCourts, loadCourts, COURTS, LOW, areaCountiesText };
})();

registerModule({
  key: 'forge', num: '21', title: 'Site Forge', desc: 'Practice area, county, city, landing, guide and attorney pages written from the court and Census data, screened by the compliance engine and compiled for WordPress and every other CMS',
  mount(root) {
    const E = SFORGE, C = FCOPY, KL = FCOPY.KL, LAW = FCOPY.LAW; const FC = typeof FORGE_COMPILE !== 'undefined' ? FORGE_COMPILE : null; const self = this;
    const merge = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], b[k]); else if (b[k] !== undefined) a[k] = b[k]; } return a; };
    let CFG = merge(E.defaultCfg(), store.get('sev.forge.cfg', {}) || {});
    let LIVE = E.parseLive(CFG.site.live, E.site(CFG).url);
    let PLAN = { pages: [], removed: [], markets: { counties: [], cities: [] } }, BUILT = new Map(), SEL = null, ASSETS = [], DEPLOYED = new Map(store.get('sev.forge.deployed', []) || []), WPSTAT = null, TAB = 'preview', PUBLISH_OK = false, IDB_OK = true, BUILT_ONCE = false;
    const save = debounce(() => { CFG.media.assets = ASSETS.map(a => ({ id: a.id, file: a.file, kind: a.kind, w: a.w, h: a.h, mime: a.mime, size: a.size, alt: a.alt || '' })); store.set('sev.forge.cfg', CFG); }, 300);
    const saveDeployed = () => store.set('sev.forge.deployed', [...DEPLOYED.entries()].slice(-500));
    const S = () => CFG.site;
    const sevName = s => ({ block: 'Blocks', fix: 'Fix', warn: 'Review', info: 'Info', note: 'Note' }[s] || s);
    const sevP = s => `<span class="pill ${s === 'block' ? 'p-block' : s === 'fix' ? 'p-fix' : s === 'warn' ? 'p-warn' : 'info'}">${esc(sevName(s))}</span>`;
    const gradeB = g => `<span class="grade ${esc(g)}">${esc(g)}</span>`;
    const ENV_NOTE = { file: 'Opened from disk or a web page: building, previews and every export work here; deploying to WordPress needs the site to allow this page\'s origin (the FORGE bridge settings list allowed origins), so use the extension or Publish when the browser refuses.', viewer: 'In the hosted viewer the network is closed: plan, build, preview and export here, and deploy from the extension or the downloaded single file.', chrome: 'Running in the extension: deploys ask once for access to the firm\'s site and then go straight to its REST API.', firefox: 'Running in the Firefox add on: deploys ask once for access to the firm\'s site and then go straight to its REST API.' }[ENV] || '';

    const SITE_F = [
      { k: 'url', l: 'Public site URL', t: 'url', ph: 'https://www.example.com', hint: 'Canonicals, schema and the live sitemap host use this. Empty uses the firm profile website.' },
      { k: 'cms', l: 'WordPress URL, if different (headless)', t: 'url' },
      { k: 'email', l: 'Lead email for form notices', t: 'email', hint: 'Empty uses the firm profile intake email.' },
      { k: 'form_provider', l: 'Lead form', t: 'select', opts: [['html', 'HTML form posting to the bridge'], ['elementor_pro', 'Elementor Pro form'], ['shortcode', 'Plugin shortcode']] },
      { k: 'form_action', l: 'Form endpoint', t: 'text', ph: '/wp-json/forge/v1/lead', hint: 'Where the HTML form posts. Empty posts to the FORGE bridge.' },
      { k: 'form_shortcode', l: 'Form shortcode (plugin forms)', t: 'text' },
      { k: 'cta_label', l: 'Primary button label', t: 'text' }, { k: 'cta_url', l: 'Primary button URL', t: 'text' },
      { k: 'template', l: 'Page template', t: 'select', opts: [['default', 'Theme default'], ['elementor_header_footer', 'Elementor full width'], ['elementor_canvas', 'Elementor canvas']], hint: 'Landing pages use canvas when the theme default is chosen.' },
      { k: 'entity', l: 'Schema entity type', t: 'select', opts: [['LegalService', 'LegalService'], ['Attorney', 'Attorney'], ['LocalBusiness', 'LocalBusiness']] },
      { k: 'hoursSchema', l: 'Hours for schema (openingHours)', t: 'text', ph: 'Mo-Fr 08:00-18:00', hint: 'Schema format; only if the office is staffed then.' },
      { k: 'sameAs', l: 'Extra profiles for sameAs, comma separated', t: 'text', hint: 'The firm profile\'s social links are added automatically.' },
      { k: 'logo_url', l: 'Logo URL', t: 'url' }, { k: 'font_heading', l: 'Heading font', t: 'text' }, { k: 'font_body', l: 'Body font', t: 'text' },
      { k: 'primary', l: 'Primary color', t: 'color' }, { k: 'accent', l: 'Accent color', t: 'color' }, { k: 'dark', l: 'Dark color', t: 'color' },
      { k: 'video_url', l: 'Explainer video URL (YouTube or Vimeo)', t: 'url' },
      { k: 'trust', l: 'Trust strip (three items separated by |)', t: 'text', wide: true, hint: '{atty}, {officeCity} and {consultShort} fill from the firm profile. Keep the responsible attorney and the office city in it: Rule 7.02(a).' },
      { k: 'about', l: 'Who the firm is, two or three sentences (optional)', t: 'textarea', wide: true, rows: 3, ph: 'Leave empty and the forge writes it from the firm profile.' },
      { k: 'testimonials', l: 'Real client reviews with permission on file (one per line: quote | name | context | rating). Leave empty to omit', t: 'textarea', wide: true, rows: 3, hint: 'The forge never writes a review. Quote only what the client wrote, never about a result, and say so if anything was given for it (Rule 7.01).' },
      { k: 'sticky', l: 'Sticky mobile call bar', t: 'checkbox' }, { k: 'noindex_landing', l: 'noindex campaign landing pages', t: 'checkbox' }, { k: 'guides_as_posts', l: 'Publish guides as posts', t: 'checkbox' }, { k: 'globals', l: 'Use Elementor global colors and fonts', t: 'checkbox' }];
    const fieldsHTML = SITE_F.map(f => fieldHTML(Object.assign({ id: 'fgs_' + f.k }, f), f.t === 'checkbox' ? (f.k === 'globals' ? CFG.site[f.k] !== false : f.k === 'sticky' ? CFG.site.sticky !== false : f.k === 'noindex_landing' ? CFG.site.noindex_landing !== false : !!CFG.site[f.k]) : f.t === 'color' ? (E.site(CFG)[f.k] || '#1b4332') : CFG.site[f.k])).join('');
    const kindOpts = Object.entries(KL).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
    const metroOpts = Object.keys(MSA).sort((a, b) => MSA[b].pop2025 - MSA[a].pop2025).map(k => [k, MNAME(MSA[k].title)]);
    const ctyOpts = CTY.slice().sort((a, b) => a.name.localeCompare(b.name));
    const fctl = (id, label, opts, val) => `<div class="ctl"><label for="${id}">${esc(label)}</label>${sel(id, opts, val)}</div>`;

    root.innerHTML = mastHTML({ eyebrow: 'Module 21 · Site Forge · the website the campaigns land on', title: 'Site Forge',
      dek: 'The atlas\'s counties, court filings and ZIP allocations turned into the firm\'s website: a page per practice area the firm sells, county and city pages written from each place\'s own filings, campaign landing pages in English and Spanish, data guides with the public source beside every figure, attorney pages and a question and answer page. Every page names the responsible lawyer and the primary office (Rule 7.02(a)), is screened by the compliance engine, carries no hyphen or dash, compiles in the browser to Elementor, semantic HTML and JSON LD, and goes to WordPress through the FORGE bridge or to any other CMS through Publish.',
      facts: [[N(CTY.length), 'counties with court filing facts'], [N(Object.keys(E.cityIndex()).length), 'cities built from metro ZIP codes'], [N(C.GUIDES.length), 'data guide topics'], [N(C.LINE_KEYS.length), 'practice areas'], ['Live URLs only', 'internal links']] }) +
      toolbarHTML('Site Forge', 'Plan, build, preview, export', [{ id: 'fgPack', label: '↓ Pack' }, { id: 'fgElZ', label: '↓ Elementor' }, { id: 'fgBpZ', label: '↓ Blueprints' }, { id: 'fgBridge', label: '↓ Bridge plugin' }, { id: 'fgLedX', label: '↓ Ledger' }, { id: 'fgSave', label: '⤓ Save' }, { id: 'fgLoad', label: '⤒ Load' }, { id: 'fgSend', label: 'Send to Publish →', primary: true }]) +
      callout('note', 'Read this first: what the forge does and does not do', `<p>Modules one to ten say where marriages are ending, which counties and ZIPs pay back and what the ads say. This module writes the pages those ads land on. Describe the firm once (the Firm button), choose the markets, tick the page types, and the forge plans the set, writes each page from the court, Census and ZIP numbers with a public source beside every figure, and screens every field with the compliance engine.</p><p>It does not publish on its own, never writes a review, a result, an award or a comparison, never links to a page that is not live on the site's sitemap, and never prints a number that is not in the data or in a statute it cites. A page with a blocking finding is not exported as ready: it goes into the pack under needs review with its findings, and Publish refuses it. ${esc(ENV_NOTE)}</p>`) +
      `<input type="file" id="fgLoadF" accept=".json,application/json" hidden>
      ${panel('1 · The site', 'Everything here flows into every page: schema, calls to action, the form, the trust strip and the attorney notice. The firm itself comes from the firm profile; the settings below are the website\'s own. Saved in this browser as you type.', `<div class="fg-firm" id="fgFirm"></div><div class="btnrow"><button type="button" class="btn primary sm" id="fgFirmEdit">Edit the firm profile</button><button type="button" class="btn sm" id="fgDesk">⇠ Import markets from the Campaign Desk</button><button type="button" class="btn sm" id="fgReset">Reset the site settings</button></div><h4 class="fh">Website settings</h4><div class="formgrid" id="fgSite">${fieldsHTML}</div>`)}
      ${panel('2 · Markets', 'Counties are ranked by the Office of Court Administration filings; cities are built from the metro ZIP codes, with each county\'s filings allocated to its ZIPs by married adults and the modeled hazard. Click a county on the map to add or drop it; click a city row to drop it.', `<div class="controls">${fctl('fgScope', 'Counties', [['firm', 'The firm\'s counties'], ['metro', 'A metro area'], ['pick', 'Hand picked counties'], ['all', 'All of Texas, ranked']], CFG.focus.scope)}${fctl('fgMetro', 'Metro', metroOpts, CFG.focus.metro)}${fctl('fgCMet', 'Rank counties by', Object.entries(E.CMET).map(([k, v]) => [k, v[0]]), CFG.focus.cmetric)}<div class="ctl"><label for="fgNc">How many counties</label><input type="number" id="fgNc" min="1" max="60" style="width:80px"></div></div>
        <div class="controls">${fctl('fgCScope', 'Cities', [['rank', 'Ranked cities in those counties'], ['pick', 'Hand picked cities']], CFG.focus.cscope)}${fctl('fgZMet', 'Rank cities by', Object.entries(E.ZMET).map(([k, v]) => [k, v[0]]), CFG.focus.zmetric)}<div class="ctl"><label for="fgN">How many cities</label><input type="number" id="fgN" min="0" max="120" style="width:80px"></div>${fctl('fgMin', 'Minimum population', [['0', 'any'], ['5000', '5,000+'], ['10000', '10,000+'], ['25000', '25,000+'], ['50000', '50,000+']], String(CFG.focus.minPop))}</div>
        <div class="controls"><div class="ctl wide"><label for="fgCounties">Hand picked counties (Ctrl or Cmd click for several)</label><select id="fgCounties" multiple size="4">${ctyOpts.map(c => `<option value="${c.fips}">${esc(c.name)} County</option>`).join('')}</select></div><div class="ctl wide"><label for="fgPicks">Hand picked cities (comma separated; other modules send their ZIPs here as cities)</label><input type="text" id="fgPicks" placeholder="Plano, Frisco, McKinney"></div></div>
        <div id="fgMkNote"></div>
        <div class="split"><div><div class="mapwrap fg-map" id="fgMap"></div></div><div><h4 class="fh">Counties in the plan</h4><div id="fgMkC"></div><h4 class="fh">Cities in the plan</h4><div id="fgMkZ"></div><p class="small">Court counts are clerk reports (grade A; the last two months are provisional). City figures are allocations of the county's filings to its ZIP codes (grade C) and Census married adults (grade B).</p></div></div>`)}
      ${panel('3 · What to build', 'Tick the page types. County guides appear only where the county\'s numbers exist; the timeline guide needs a monthly court series. Spanish landing pages appear only when the firm profile says the staff speaks Spanish.', `<div class="btnrow" id="fgTypes">${[['home', 'Home page'], ['about', 'About page'], ['attorneys', 'Attorney page per lawyer'], ['practice', 'Practice area page per line'], ['faq', 'Question and answer page'], ['counties', 'County page per county'], ['cities', 'City page per city'], ['landing', 'Campaign landing pages'], ['es', 'Spanish landing variants'], ['guides', 'Data guides']].map(([k, l]) => `<label class="chk"><input type="checkbox" data-b="${k}"> ${esc(l)}</label>`).join('')}</div>
        <h4 class="fh">Practice area pages</h4><div class="fg-chips" id="fgLines"></div><h4 class="fh">Landing page lines</h4><div class="fg-chips" id="fgLand"></div><h4 class="fh">Guide topics</h4><div class="fg-chips" id="fgTopics"></div>
        ${callout('judg', 'Doorway risk: fewer, better location pages', 'Templated city pages are the fastest route into a doorway or scaled content problem. Every county and city page here carries that place\'s own filings, courthouse and ZIP numbers, but a dozen pages from one template still read as a pattern. Publish a city page only where its numbers say something the county page does not, keep landing pages out of the index, and consolidate before adding more.')}
        <div class="btnrow"><button type="button" class="btn primary" id="fgBuild">⚒ Build all pages</button><span class="small" id="fgBuildNote"></span></div>`)}
      <div class="tiles" id="fgKpis"></div>
      ${panel('4 · Live pages on the site', 'The only pages the forge will ever link to. Paste the site\'s XML sitemap (the page and post sitemaps, not the index) or a list of live URLs, one per line, optionally as "anchor | URL". Pages in this plan become link targets once they are published and appear here.', `<div class="ctl wide"><label for="fgLive">Sitemap or URL list</label><textarea id="fgLive" class="fg-code" rows="5" placeholder="&lt;urlset&gt;&lt;url&gt;&lt;loc&gt;https://www.example.com/divorce-lawyer/&lt;/loc&gt;&lt;/url&gt;...&lt;/urlset&gt;"></textarea></div><div class="small" id="fgLiveSum" style="margin-top:6px"></div>`)}
      ${panel('5 · The page ledger', 'Every planned page with its slug, lengths, words and checks. Click a row to open it in the studio; remove what you do not want.', `<div class="controls"><div class="ctl"><label for="fgLType">Type</label><select id="fgLType"><option value="">All types</option>${kindOpts}</select></div><div class="ctl"><label for="fgLSearch">Search</label><input type="text" id="fgLSearch" placeholder="city, line, slug"></div><label class="chk"><input type="checkbox" id="fgLRem"> Show removed pages</label><label class="chk"><input type="checkbox" id="fgLBlk"> Only pages that need review</label></div><div id="fgLedger"></div>`)}
      ${panel('6 · Page studio', '<span id="fgStHead">Select a page in the ledger.</span>', `<div id="fgStBlock"></div><div class="formgrid"><div class="ctl"><label for="fgStTitle">Title <span class="small" id="fgStTitleC"></span></label><input type="text" id="fgStTitle"></div><div class="ctl"><label for="fgStH1">H1 <span class="small" id="fgStH1C"></span></label><input type="text" id="fgStH1"></div><div class="ctl"><label for="fgStSlug">Slug</label><input type="text" id="fgStSlug"></div><div class="ctl wide"><label for="fgStMeta">Meta description <span class="small" id="fgStMetaC"></span></label><input type="text" id="fgStMeta"></div></div>
        <div class="btnrow"><button type="button" class="btn sm primary" id="fgStApply">Apply and rebuild</button><button type="button" class="btn sm" id="fgStReset">Discard edits</button><button type="button" class="btn sm danger" id="fgStRemove">Remove from plan</button><span class="fg-sp"></span><button type="button" class="btn sm" id="fgStBp">↓ Blueprint</button><button type="button" class="btn sm" id="fgStEl">↓ Elementor template</button><button type="button" class="btn sm" id="fgStHtml">↓ Preview HTML</button><button type="button" class="btn sm" id="fgStBundle">↓ Bridge bundle</button></div>
        <div class="fg-studio"><div class="fg-main">${segHTML('fgStTabs', [['preview', 'Preview'], ['mobile', 'Mobile'], ['blueprint', 'Blueprint'], ['elementor', 'Elementor JSON'], ['schema', 'Schema'], ['html', 'HTML']], TAB)}<div id="fgStPane" class="fg-pane"></div></div>
        <div class="fg-side"><h4 class="fh">Checks</h4><div id="fgChecks"><span class="small">No page open.</span></div><h4 class="fh">Facts on this page · value, source, grade</h4><div id="fgFacts"></div><h4 class="fh">Internal links · live URLs only</h4><div id="fgLinks"></div></div></div>`, { id: 'fgStudio' })}
      ${panel('7 · Media', 'Drop photos and video of the real office, lawyers and staff. Images are resized to 1,920 pixels and converted to WebP in the browser, and kept in this browser\'s storage so they survive a reload. Assign each to the pages it belongs to: a page asset beats a city asset, which beats a county asset, a page type asset and the site default. Unassigned slots resolve from the site\'s media library at deploy, and a page never ships with a placeholder.', `<div class="dropzone" id="fgDrop" tabindex="0" role="button" aria-label="Add photos or video">Drop files here or click to choose: JPG, PNG, WebP, MP4, WebM</div><input type="file" id="fgFile" multiple accept="image/*,video/mp4,video/webm" hidden><div class="small" id="fgMediaNote" style="margin-top:6px"></div><div class="tblwrap" style="margin-top:10px"><table class="t fg-media"><thead><tr><th>Preview</th><th>File</th><th>Size</th><th>Assign to</th><th>Alt text</th><th>Remove</th></tr></thead><tbody id="fgMediaRows"></tbody></table></div>`)}
      ${panel('8 · Deploy to WordPress', 'Application Password over REST through the FORGE bridge plugin (download it from the toolbar, then Plugins, Add New, Upload, Activate). Everything lands as a draft unless you choose to publish. Credentials stay in this tab and are not saved. Every other platform (headless WordPress with the Next.js kit, Drupal, Wix, Duda, Webflow, Shopify, HubSpot, Joomla, Ghost) publishes from module 22, Publish, which reads the pages built here.', `<div class="formgrid"><div class="ctl"><label for="fgdUrl">WordPress URL</label><input type="text" inputmode="url" id="fgdUrl"></div><div class="ctl"><label for="fgdUser">Username</label><input type="text" id="fgdUser" autocomplete="off"></div><div class="ctl"><label for="fgdPass">Application password</label><input type="password" id="fgdPass" autocomplete="off"><span class="hint">Users, Profile, Application Passwords. An Administrator account is needed for Elementor data.</span></div></div>
        <div class="btnrow"><button type="button" class="btn sm" id="fgdTest">Test connection</button><span class="small" id="fgdNote">Not connected.</span></div>
        <div id="fgdCors" hidden>${callout('judg', 'The browser could not reach the site', `In the hosted viewer every outbound connection is blocked; from a page opened from disk the site has to allow this page's origin (add it to the bridge's allowed origins in its settings). The extension asks for access to the site instead. Origin of this page: <code id="fgdOrigin"></code>.`)}</div>
        <div class="btnrow"><label class="chk"><input type="checkbox" id="fgdMedia" checked> Upload assets and reuse library matches</label><label class="chk"><input type="checkbox" id="fgdPublish"> Publish instead of draft</label><label class="chk"><input type="checkbox" id="fgdOnlyNew" checked> Skip pages already deployed</label></div>
        <div id="fgdConfirm" hidden class="callout judg"><div class="h" id="fgdConfirmT"></div><div class="btnrow"><button type="button" class="btn sm primary" id="fgdConfirmGo">Publish them</button><button type="button" class="btn sm" id="fgdConfirmNo">Keep as drafts</button></div></div>
        <div class="btnrow"><button type="button" class="btn primary" id="fgdGo" disabled>Deploy pages</button><button type="button" class="btn" id="fgdLive" disabled>Refresh live URLs from the site</button><button type="button" class="btn" id="fgdLinks" disabled>Verify links against live URLs</button><button type="button" class="btn" id="fgdIdx" disabled>IndexNow published pages</button></div>
        <div class="logbox" id="fgdStatus">Not connected.</div>
        <div class="tblwrap" style="margin-top:10px"><table class="t"><thead><tr><th>Page</th><th>Status</th><th>Link</th><th>Edit</th><th>Media</th><th>Note</th></tr></thead><tbody id="fgdRes"></tbody></table></div>`)}
      ${panel('9 · Method, sources, grades and the hand off', 'How a page is written, where every number comes from, and what to check before anything goes live.', '<div id="fgMethod"></div>')}
      <p class="small">The Site Forge writes pages; it does not publish them on its own. The FORGE bridge plugin is a generic WordPress REST bridge; read it before installing it on a production site. Pages are general information about Texas law and attorney advertising; the firm reviews each before it goes live and files as Rule 7.04 requires.</p>`;

    /* ---------- the site ---------- */
    function renderFirm() {
      const F = FIRM.get(); const r = FIRM.responsible(); const o = FIRM.primary(); const miss = FIRM.missing(); const lines = E.linesSold(); const cs = FIRM.counties();
      $('#fgFirm', root).innerHTML = `<dl class="kv fg-kv"><dt>Firm</dt><dd>${esc(F.name || '[Firm name]')}</dd><dt>Responsible lawyer</dt><dd>${esc(r.name || '[Responsible attorney]')}${r.bar_no ? ' · Bar No. ' + esc(r.bar_no) : ''}</dd><dt>Primary office</dt><dd>${esc([o.street, o.city, o.zip].filter(Boolean).join(', ') || '[Office city]')}</dd><dt>Phone</dt><dd>${esc(FIRM.phone() || '[Phone]')}</dd><dt>Website</dt><dd>${esc(F.url || 'not set')}</dd><dt>Counties served</dt><dd>${cs.length ? esc(cs.map(cname).join(', ')) : 'none yet'}</dd><dt>Practice areas</dt><dd>${lines.length ? esc(lines.map(k => LINE_META[k] ? LINE_META[k].short : k).join(', ')) : 'none'}</dd><dt>Languages</dt><dd>${(F.languages || []).includes('es') ? 'English and Spanish' : 'English'}</dd><dt>Consultations</dt><dd>${esc(E.baseVars(CFG, null).consultShort)}${(F.consult || {}).virtual ? ', video available' : ''}</dd></dl>` +
        (miss.length ? `<div class="callout fg-miss"><div class="h">The firm profile is not complete</div><p>Missing: ${esc(miss.join(', '))}. Until it is filled, pages carry bracketed placeholders such as [Firm name], and the compliance engine blocks every page that still has one.</p></div>` : '');
    }
    function writeSite() { $$('[data-k]', $('#fgSite', root)).forEach(i => { const k = i.dataset.k; const v = CFG.site[k]; if (i.type === 'checkbox') i.checked = k === 'globals' || k === 'sticky' || k === 'noindex_landing' ? v !== false : !!v; else if (i.type === 'color') i.value = E.site(CFG)[k] || '#1b4332'; else i.value = v == null ? '' : v; }); }
    function readSite() { const F = FIRM.get(); $$('[data-k]', $('#fgSite', root)).forEach(i => { const k = i.dataset.k; if (i.type === 'checkbox') CFG.site[k] = i.checked; else if (i.type === 'color') CFG.site[k] = i.value === ((F.colors || {})[k] || '') ? '' : i.value; else CFG.site[k] = String(i.value || '').trim(); }); }
    $$('[data-k]', $('#fgSite', root)).forEach(i => i.addEventListener('change', () => { readSite(); save(); LIVE = E.parseLive(S().live, E.site(CFG).url); renderLive(); replan(); }));
    $('#fgFirmEdit', root).onclick = () => FIRM.panel();
    $('#fgReset', root).onclick = () => { const live = S().live; CFG.site = E.defaultCfg().site; CFG.site.live = live; writeSite(); save(); replan(); toast('Website settings reset; the firm profile is unchanged'); };
    $('#fgDesk', root).onclick = () => { const d = store.get('sev.desk', null); if (!d || !d.geo) { toast('Open the Campaign Desk once so its plan exists'); return; }
      const [t, id] = String(d.geo).split(':'); if (t === 'msa' && MSA[id]) { CFG.focus.scope = 'metro'; CFG.focus.metro = id; } else if (t === 'cty' && CI[id]) { CFG.focus.scope = 'pick'; CFG.focus.counties = [id]; }
      const sold = E.linesSold(); const ls = (d.lines || []).filter(k => sold.includes(k)); if (ls.length) CFG.build.landingLines = ls.slice(0, 3);
      syncFocus(); syncBuild(); save(); replan(); $('#fgBuildNote', root).textContent = `Imported from the Campaign Desk: ${t === 'msa' && MSA[id] ? MNAME(MSA[id].title) : CI[id] ? CI[id].name + ' County' : 'scope kept'}, ${ls.length} landing line${ls.length === 1 ? '' : 's'}.`; };

    /* ---------- markets ---------- */
    function syncFocus() { const f = CFG.focus; $('#fgScope', root).value = f.scope; $('#fgMetro', root).value = f.metro; $('#fgCMet', root).value = f.cmetric; $('#fgNc', root).value = f.nc; $('#fgCScope', root).value = f.cscope; $('#fgZMet', root).value = f.zmetric; $('#fgN', root).value = f.n; $('#fgMin', root).value = String(f.minPop);
      const X = E.cityIndex(); $('#fgPicks', root).value = f.cpicks.map(k => X[k] ? X[k].name : '').filter(Boolean).join(', '); $$('#fgCounties option', root).forEach(o => o.selected = f.counties.includes(o.value));
      $('#fgMetro', root).closest('.ctl').hidden = f.scope !== 'metro'; $('#fgNc', root).closest('.ctl').hidden = !(f.scope === 'metro' || f.scope === 'all'); $('#fgCounties', root).closest('.ctl').hidden = f.scope !== 'pick'; $('#fgPicks', root).closest('.ctl').hidden = f.cscope !== 'pick'; $('#fgN', root).closest('.ctl').hidden = f.cscope === 'pick'; $('#fgMin', root).closest('.ctl').hidden = f.cscope === 'pick'; }
    function citiesByName(names) { const X = E.cityIndex(); const cs = new Set(PLAN.markets.counties.map(c => c.fips)); const out = []; names.forEach(nm => { const n = String(nm).trim().toLowerCase(); if (!n) return; const all = Object.values(X).filter(x => x.name.toLowerCase() === n); const best = all.find(x => cs.has(x.county)) || all.sort((a, b) => b.pop - a.pop)[0]; if (best && !out.includes(best.key)) out.push(best.key); }); return out; }
    function citiesFromZips(zips) { const X = E.cityIndex(); const out = []; zips.forEach(z => { const r = ZI[z]; if (!r || !r.city || !r.msa) return; const k = r.msa + '|' + r.city; if (X[k] && !out.includes(k)) out.push(k); }); return out; }
    function readFocus() { const f = CFG.focus; f.scope = $('#fgScope', root).value; f.metro = $('#fgMetro', root).value; f.cmetric = $('#fgCMet', root).value; f.nc = clamp(+$('#fgNc', root).value || 6, 1, 254); f.cscope = $('#fgCScope', root).value; f.zmetric = $('#fgZMet', root).value; f.n = clamp(+$('#fgN', root).value || 0, 0, 200); f.minPop = +$('#fgMin', root).value || 0;
      f.counties = $$('#fgCounties option', root).filter(o => o.selected).map(o => o.value); f.picks = undefined; f.cpicks = citiesByName($('#fgPicks', root).value.split(',')); }
    ['#fgScope', '#fgMetro', '#fgCMet', '#fgNc', '#fgCScope', '#fgZMet', '#fgN', '#fgMin', '#fgCounties', '#fgPicks'].forEach(s => $(s, root).addEventListener('change', () => { const was = CFG.focus.scope, wasC = CFG.focus.cscope; readFocus(); if (CFG.focus.scope === 'pick' && was !== 'pick' && !CFG.focus.counties.length) CFG.focus.counties = PLAN.markets.counties.map(c => c.fips); if (CFG.focus.cscope === 'pick' && wasC !== 'pick' && !CFG.focus.cpicks.length) CFG.focus.cpicks = PLAN.markets.cities.map(x => x.key); syncFocus(); save(); replan(); }));
    function toggleCounty(f) { const F0 = CFG.focus; if (F0.scope !== 'pick') { F0.scope = 'pick'; F0.counties = PLAN.markets.counties.map(c => c.fips); } if (F0.counties.includes(f)) F0.counties = F0.counties.filter(x => x !== f); else F0.counties.push(f); syncFocus(); save(); replan(); }
    function dropCity(k) { const F0 = CFG.focus; if (F0.cscope !== 'pick') { F0.cscope = 'pick'; F0.cpicks = PLAN.markets.cities.map(x => x.key); } F0.cpicks = F0.cpicks.filter(x => x !== k); syncFocus(); save(); replan(); }
    let tblC = null, tblZ = null;
    function renderFocus() {
      const ms = PLAN.markets; const f = CFG.focus; const cm = E.CMET[f.cmetric] || E.CMET.div; const zm = E.ZMET[f.zmetric] || E.ZMET.div;
      const cand = f.scope === 'metro' && MSA[f.metro] ? MSA[f.metro].counties.map(x => CI[x]).filter(Boolean) : f.scope === 'all' ? CTY : ms.counties; const inPlan = new Set(ms.counties.map(c => c.fips));
      const vals = cand.map(cm[1]); const q = quantScale(vals); const candSet = new Set(cand.map(c => c.fips));
      drawMap($('#fgMap', root), { W: GEO.state.W, H: GEO.state.H, paths: GEO.state.county, outline: GEO.state.outline, title: 'Counties in the plan', value: id => candSet.has(id) ? cm[1](CI[id]) : null, color: v => rampColor('forest', q(v)),
        label: id => { const c = CI[id]; const t = c.filings.ttm; return `<b>${esc(c.name)} County</b><div class="row"><span>${esc(cm[0])}</span><span>${esc(N(cm[1](c), f.cmetric === 'per_office' ? 1 : 0))}</span></div><div class="row"><span>Divorce filings, 12 mo</span><span>${N(t.div)}</span></div><div class="row"><span>Protective orders</span><span>${N(t.po)}</span></div><div class="row"><span>${inPlan.has(id) ? 'In the plan · click to drop' : 'Click to add'}</span><span></span></div>`; },
        onSelect: id => toggleCounty(id), legend: { title: cm[0], min: N(Math.min(...vals.filter(isN))), max: N(Math.max(...vals.filter(isN))) }, ramp: 'forest', noDataLabel: 'not a candidate' });
      $$('#fgMap path.area', root).forEach(p => p.classList.toggle('fg-on', inPlan.has(p.dataset.id)));
      const crow = c => ({ _id: c.fips, name: c.name, v: cm[1](c), div: c.filings.ttm.div, divk: c.filings.ttm.div_k, po: c.filings.ttm.po, married: c.acs.married, offices: c.rates.lawoffices, court: (E.COURTS[c.fips] || {}).n || '' });
      const ccols = [{ k: 'name', l: 'County', fmt: v => esc(v) }, { k: 'v', l: cm[0], fmt: v => N(v, f.cmetric === 'per_office' ? 1 : 0) }, { k: 'div', l: 'Divorce 12 mo', fmt: v => N(v) }, { k: 'divk', l: 'With kids', fmt: v => N(v) }, { k: 'po', l: 'PO', fmt: v => N(v) }, { k: 'married', l: 'Married', fmt: v => K(v) }, { k: 'offices', l: 'Law offices', fmt: v => N(v) }, { k: 'court', l: 'Courthouse', fmt: v => v ? `<span class="small">${esc(v)}</span>` : '<span class="small">n/a</span>', cls: 'fg-l' }];
      if (!tblC) tblC = table($('#fgMkC', root), { cols: ccols, rows: ms.counties.map(crow), sort: { k: 'v', dir: -1 }, onRow: id => toggleCounty(id) }); else { tblC.setRows(ms.counties.map(crow)); }
      const zrow = x => ({ _id: x.key, name: x.name, cty: cname(x.county), v: zm[1](x), div: x.div, married: x.married, eff: x.eff, zips: x.zips.length, pop: x.pop });
      const zcols = [{ k: 'name', l: 'City', fmt: v => esc(v) }, { k: 'cty', l: 'County', fmt: v => esc(v), cls: 'fg-l' }, { k: 'v', l: zm[0], fmt: v => N(v, f.zmetric === 'per_office' ? 1 : 0) }, { k: 'div', l: 'Divorce a year (est.)', fmt: v => N(v) }, { k: 'married', l: 'Married', fmt: v => K(v) }, { k: 'eff', l: 'Efficiency', fmt: v => N(v) }, { k: 'zips', l: 'ZIPs', fmt: v => N(v) }];
      if (!tblZ) tblZ = table($('#fgMkZ', root), { cols: zcols, rows: ms.cities.map(zrow), sort: { k: 'v', dir: -1 }, onRow: id => dropCity(id) }); else tblZ.setRows(ms.cities.map(zrow));
      const notes = []; if (f.scope === 'firm' && !FIRM.counties().length) notes.push('The firm profile names no counties and no office county yet. Fill it (the Firm button), or choose a metro or hand picked counties here.');
      if (ms.counties.length && !ms.cities.length && f.cscope !== 'pick') notes.push('No city in these counties passes the filters; city pages and city landing pages are skipped, and landing pages are written per county instead. Lower the population floor or pick cities.');
      $('#fgMkNote', root).innerHTML = notes.map(n => callout('', 'Markets', n)).join('');
    }

    /* ---------- build choices ---------- */
    function chipRow(host, ids, selIds, label, onToggle) { host.innerHTML = ids.length ? ids.map(id => `<button type="button" class="fg-chip" data-id="${esc(id)}" aria-pressed="${selIds.includes(id)}">${esc(label(id))}</button>`).join('') : '<span class="small">The firm profile lists no practice areas.</span>'; $$('button', host).forEach(b => b.onclick = () => onToggle(b.dataset.id)); }
    function syncBuild() { const B = CFG.build; $$('#fgTypes [data-b]', root).forEach(i => { i.checked = !!B[i.dataset.b]; if (i.dataset.b === 'es') { i.disabled = !E.hasEs(); i.parentElement.title = E.hasEs() ? '' : 'The firm profile does not list Spanish speaking staff'; } });
      const sold = E.linesSold(); const tog = (arr, id) => arr.includes(id) ? arr.filter(x => x !== id) : arr.concat([id]); const lab = id => LINE_META[id] ? LINE_META[id].short : id;
      chipRow($('#fgLines', root), sold, E.activeLines(CFG), lab, id => { B.lines = tog(E.activeLines(CFG), id); syncBuild(); save(); replan(); });
      chipRow($('#fgLand', root), sold, E.landingLines(CFG), lab, id => { B.landingLines = tog(E.landingLines(CFG), id); syncBuild(); save(); replan(); });
      chipRow($('#fgTopics', root), C.GUIDES.map(g => g.id), B.topics || [], id => { const g = C.GUIDES.find(x => x.id === id); return g.label + (g.scope === 'county' ? ' (per county)' : ''); }, id => { B.topics = tog(B.topics || [], id); syncBuild(); save(); replan(); }); }
    $$('#fgTypes [data-b]', root).forEach(i => i.onchange = () => { CFG.build[i.dataset.b] = i.checked; save(); replan(); });

    /* ---------- live URLs ---------- */
    $('#fgLive', root).addEventListener('change', () => { S().live = $('#fgLive', root).value; LIVE = E.parseLive(S().live, E.site(CFG).url); save(); renderLive(); rebuildBuilt(); });
    const hostOfUrl = u => { try { return new URL(u).hostname; } catch (e) { return u || 'no site URL set'; } };
    function renderLive() { const L = LIVE; const h = $('#fgLiveSum', root); const u = E.site(CFG).url;
      if (!L.items.length) { h.innerHTML = L.index ? '<b>This is a sitemap index.</b> Paste the child page and post sitemaps it lists.' : `<b>No live URLs yet.</b> Pages build without internal links until the site's live URLs are here${u ? ' (host ' + esc(hostOfUrl(u)) + ')' : ''}.`; return; }
      h.innerHTML = `<b>${N(L.items.length)} live URLs</b> on ${esc(hostOfUrl(u))}${L.notes.length ? ' · ' + esc(L.notes.join('; ')) : ''}. Examples: ${L.items.slice(0, 5).map(l => `<code>${esc(l.path)}</code>`).join(' ')}`; }

    /* ---------- plan and build ---------- */
    function maybeCourts() { const ks = E.needCourts(PLAN.markets.counties); if (!ks.length) return; E.loadCourts(ks).then(r => { if (r.some(Boolean) && root.isConnected !== false) { replan(); toast('Courthouse addresses added from the Metro Atlas'); } }); }
    function replan() { PLAN = E.plan(CFG); const ids = new Set(PLAN.pages.map(p => p.id)); for (const k of [...BUILT.keys()]) if (!ids.has(k)) BUILT.delete(k); BUILT.forEach((b, id) => { const p = PLAN.pages.find(x => x.id === id); if (p) buildPage(p); }); renderFocus(); renderKpis(); renderLedger(); renderFirm(); if (SEL) { if (ids.has(SEL)) openPage(SEL, true); else closeStudio(); } maybeCourts(); }
    function previewMedia(bp) { const map = {}; for (const [k, spec] of Object.entries(bp.media || {})) { const src = spec.source || ''; if (src.startsWith('assets/')) { const a = ASSETS.find(x => x.file === src.slice(7)); if (a) map[k] = { id: 0, url: a.url, alt: a.alt || spec.alt, kind: a.kind, width: a.w, height: a.h }; } else if (/^https?:/.test(src) && spec.kind === 'video') map[k] = { id: 0, url: src, alt: spec.alt, kind: 'video' }; } return map; }
    const compile = (bp, media) => { if (!FC) return { html: '', preview: '<p>The compiler is not loaded.</p>', schema: {}, template: {}, elementor_data: [], page_settings: {}, seo: {}, lint: ['BLOCK: the blueprint compiler (src/04_forge_compile.js) is not loaded'] }; return FC.compile(bp, media); };
    const stripBp = bp => { const o = Object.assign({}, bp); delete o._facts; delete o._missing; delete o._v; return o; };
    function buildPage(p) { const prev = BUILT.get(p.id); let bp = prev && prev.override ? prev.override : E.blueprint(p, CFG, PLAN.pages, LIVE, PLAN.markets, ASSETS); let r; try { r = compile(stripBp(bp), previewMedia(bp)); } catch (e) { console.error(e); r = { html: '', preview: '<p>Compile error: ' + esc(e.message) + '</p>', schema: {}, template: {}, lint: ['BLOCK: compile error, ' + e.message] }; } const ch = E.checks(bp, r); const b = { bp, r, ch, words: E.wordCount(bp), override: prev ? prev.override : null }; BUILT.set(p.id, b); return b; }
    function ensureBuilt() { PLAN.pages.forEach(p => { if (!BUILT.has(p.id)) buildPage(p); }); }
    function rebuildBuilt() { PLAN = E.plan(CFG); BUILT.forEach((b, id) => { const p = PLAN.pages.find(x => x.id === id); if (p) buildPage(p); }); renderKpis(); renderLedger(); if (SEL) openPage(SEL, true); }
    $('#fgBuild', root).onclick = () => { const t0 = performance.now(); PLAN.pages.forEach(p => buildPage(p)); BUILT_ONCE = true; renderKpis(); renderLedger(); const bl = PLAN.pages.filter(p => (BUILT.get(p.id) || {}).ch && BUILT.get(p.id).ch.block).length;
      $('#fgBuildNote', root).textContent = `Built and screened ${PLAN.pages.length} pages in ${Math.round(performance.now() - t0)} ms. ${bl ? bl + ' need review: a blocking finding keeps them out of the ready exports and Publish.' : 'Every page passes the compliance screen.'}`; if (!SEL && PLAN.pages.length) openPage(PLAN.pages[0].id, true); BUS.emit('forge', { pages: PLAN.pages.length, blocked: bl }); };
    const isBlocked = b => !!(b && b.ch && b.ch.block);
    function renderKpis() {
      const P0 = PLAN.pages; const bs = P0.map(p => BUILT.get(p.id)).filter(Boolean); const by = k => P0.filter(p => p.kind === k).length; const ms = PLAN.markets; const div = sum(ms.counties.map(c => c.filings.ttm.div || 0));
      $('#fgKpis', root).innerHTML = tile('Pages planned', N(P0.length), `${by('practice')} practice · ${by('county')} county · ${by('city')} city · ${by('landing')} landing · ${by('guide')} guides`) +
        tile('Counties in the plan', N(ms.counties.length), ms.counties.slice(0, 4).map(c => esc(c.name)).join(', ') + (ms.counties.length > 4 ? ' and ' + (ms.counties.length - 4) + ' more' : '')) +
        tile('Cities in the plan', N(ms.cities.length), ms.cities.slice(0, 4).map(x => esc(x.name)).join(', ') + (ms.cities.length > 4 ? ' and ' + (ms.cities.length - 4) + ' more' : '')) +
        tile('Divorce filings, plan counties', N(div), 'last 12 months reported, Office of Court Administration', 'A') +
        tile('Built', `${N(bs.length)} of ${N(P0.length)}`, bs.length ? `${N(sum(bs.map(b => b.words)))} words` : 'press Build all pages') +
        tile('Need review', N(bs.filter(isBlocked).length), `${N(sum(bs.map(b => b.ch.block)))} blocking findings · ${N(sum(bs.map(b => b.ch.warn)))} to review`) +
        tile('Internal links', N(sum(bs.map(b => b.bp.page.internal_links.length))), LIVE.items.length ? `from ${N(LIVE.items.length)} live URLs` : 'none until live URLs are pasted');
    }
    let tblL = null;
    function ledgerRows() {
      const t = $('#fgLType', root).value, q = $('#fgLSearch', root).value.trim().toLowerCase(), showRem = $('#fgLRem', root).checked, onlyB = $('#fgLBlk', root).checked; const idx = new Map(PLAN.pages.map((p, i) => [p.id, i]));
      return PLAN.pages.concat(showRem ? PLAN.removed.map(p => Object.assign({ _rem: true }, p)) : []).filter(p => (!t || p.kind === t) && (!q || (p.label + ' ' + p.slug + ' ' + (p.city || '') + ' ' + (p.line || '')).toLowerCase().includes(q)) && (!onlyB || isBlocked(BUILT.get(p.id))))
        .map(p => { const b = BUILT.get(p.id); const d = DEPLOYED.get(p.id) || {}; return { _id: p.id, n: idx.has(p.id) ? idx.get(p.id) + 1 : null, kind: KL[p.kind], label: p.label, p, slug: p.slug, tl: p.title.length, ml: p.meta.length, w: b ? b.words : null, bl: b ? b.ch.block : null, wa: b ? b.ch.warn : null, lk: b ? b.bp.page.internal_links.length : null, st: p._rem ? 'removed' : !b ? '' : isBlocked(b) ? 'needs review' : (d.status || 'ready') }; });
    }
    function renderLedger() {
      const rows = ledgerRows();
      const cols = [{ k: 'n', l: '#', fmt: v => v == null ? '' : v }, { k: 'kind', l: 'Type', fmt: v => esc(v), cls: 'fg-l' }, { k: 'label', l: 'Page', cls: 'fg-l fg-wrap', fmt: (v, r) => esc(v) + (r.p.lang === 'es' ? ' ' + pill('ES') : '') + (r.p._rem ? ' ' + pill('removed') : '') + (CFG.edits[r.p.id] ? ' ' + pill('edited') : '') }, { k: 'slug', l: 'Slug', cls: 'fg-l', fmt: v => `<span class="mono fg-slug">/${esc(v)}/</span>` },
        { k: 'tl', l: 'Title', fmt: v => `<span class="${v > 60 ? 'fg-bad' : ''}">${v}</span>` }, { k: 'ml', l: 'Meta', fmt: v => `<span class="${v > 158 || v < 70 ? 'fg-warnc' : ''}">${v}</span>` }, { k: 'w', l: 'Words', fmt: v => isN(v) ? N(v) : '·' }, { k: 'bl', l: 'Blocks', fmt: v => isN(v) ? (v ? `<b class="fg-bad">${v}</b>` : '0') : '·' }, { k: 'wa', l: 'Review', fmt: v => isN(v) ? v : '·' }, { k: 'lk', l: 'Links', fmt: v => isN(v) ? v : '·' },
        { k: 'st', l: 'Status', cls: 'fg-l', fmt: v => v ? pill(v, v === 'needs review' ? 'p-block' : v === 'ready' ? 'p-ok' : v === 'error' ? 'p-block' : '') : '' }];
      if (!tblL) tblL = table($('#fgLedger', root), { cols, rows, sort: { k: 'n', dir: 1 }, selected: SEL, onRow: id => { const p = PLAN.removed.find(x => x.id === id); if (p) { delete CFG.removed[id]; save(); replan(); toast('Restored ' + p.label); return; } openPage(id); } });
      else { tblL.setRows(rows); tblL.setSel(SEL); }
      if (!rows.length) $('#fgLedger', root).innerHTML = '<p class="small">No pages match.</p>', tblL = null;
    }
    ['#fgLType', '#fgLSearch', '#fgLRem', '#fgLBlk'].forEach(s => $(s, root).addEventListener('input', renderLedger));

    /* ---------- studio ---------- */
    function closeStudio() { SEL = null; $('#fgStHead', root).textContent = 'Select a page in the ledger.'; $('#fgStPane', root).innerHTML = ''; $('#fgChecks', root).innerHTML = '<span class="small">No page open.</span>'; $('#fgFacts', root).innerHTML = ''; $('#fgLinks', root).innerHTML = ''; $('#fgStBlock', root).innerHTML = ''; }
    function counters() { const t = $('#fgStTitle', root).value.length, h = $('#fgStH1', root).value.length, m = $('#fgStMeta', root).value.length; const set = (id, txt, bad) => { const e = $(id, root); e.textContent = txt; e.className = 'small' + (bad ? ' fg-bad' : ''); }; set('#fgStTitleC', `${t} of 60`, t > 60); set('#fgStH1C', `${h} of 70`, h > 70); set('#fgStMetaC', `${m}, aim 120 to 158`, m < 120 || m > 158); }
    ['#fgStTitle', '#fgStH1', '#fgStMeta'].forEach(s => $(s, root).addEventListener('input', counters));
    function openPage(id, quiet) {
      const p = PLAN.pages.find(x => x.id === id); if (!p) return; SEL = id; const b = BUILT.get(id) || buildPage(p);
      $('#fgStHead', root).innerHTML = `<b>${esc(KL[p.kind])}</b> · ${esc(p.label)} · <span class="mono">/${esc(p.slug)}/</span> · ${N(b.words)} words${b.override ? ' · ' + pill('edited blueprint') : ''}`;
      $('#fgStTitle', root).value = p.title; $('#fgStH1', root).value = p.h1; $('#fgStSlug', root).value = p.slug; $('#fgStMeta', root).value = p.meta; counters();
      $('#fgStBlock', root).innerHTML = isBlocked(b) ? callout('', `Needs review: ${b.ch.block} blocking finding${b.ch.block === 1 ? '' : 's'}`, 'This page is not exported as ready and Publish refuses it until the findings below are fixed (often the firm profile, the edits here, or the trust strip). It still previews so you can see what it says.') : '';
      renderPane(); const ch = b.ch;
      $('#fgChecks', root).innerHTML = ch.issues.length ? ch.issues.map(i => `<div class="fg-issue ${esc(i.sev)}">${sevP(i.sev)} <b>${esc(i.id)}</b> ${esc(i.msg)}${i.ev ? ` <span class="small">“${esc(i.ev)}”</span>` : ''}<div class="small">${esc(i.where)}${i.cite ? ' · ' + esc(i.cite) : ''}${i.fix ? ' · ' + esc(i.fix) : ''}</div></div>`).join('') : '<div class="callout note"><div class="h">No findings</div><p>The page passes the compliance screen, the house style and the compiler checks.</p></div>';
      $('#fgFacts', root).innerHTML = (b.bp._facts || []).length ? b.bp._facts.map(f => `<div class="fg-row"><span>${esc(f.value)} <span class="small">${esc(f.label)}</span><br><span class="small">${esc(f.source)}</span></span>${gradeB(f.grade)}</div>`).join('') : '<span class="small">This page states no figures.</span>';
      const L = b.bp.page.internal_links || []; $('#fgLinks', root).innerHTML = L.length ? L.map(l => `<div class="fg-row"><span>${esc(l.anchor)}</span><span class="small mono">${esc(l.url)}</span></div>`).join('') : `<span class="small">${LIVE.items.length ? 'No live URL matches this page.' : 'None: paste the live sitemap in step 4.'}</span>`;
      renderLedger(); if (!quiet) { try { $('#fgStudio', root).scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { } }
    }
    function renderPane() {
      const host = $('#fgStPane', root); if (!SEL) { host.innerHTML = ''; return; } const b = BUILT.get(SEL); if (!b) return;
      $$('#fgStTabs button', root).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === TAB)));
      if (TAB === 'preview' || TAB === 'mobile') { host.innerHTML = `<div class="${TAB === 'mobile' ? 'fg-mobile' : ''}"><iframe class="preview" sandbox="allow-same-origin" title="Page preview" referrerpolicy="no-referrer"></iframe></div>`; $('iframe', host).srcdoc = String(b.r.preview || '').replace(/<script(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, ''); return; }
      if (TAB === 'blueprint') { const bp = stripBp(b.bp); host.innerHTML = `<label class="small" for="fgBpTxt">Blueprint JSON, editable</label><textarea class="fg-code" id="fgBpTxt" rows="24">${esc(JSON.stringify(bp, null, 1))}</textarea><div class="btnrow"><button type="button" class="btn sm primary" id="fgBpUse">Use edited blueprint</button><button type="button" class="btn sm" id="fgBpDrop">Back to the generated blueprint</button><span class="small" id="fgBpMsg"></span></div>`;
        $('#fgBpUse', host).onclick = () => { let o; try { o = JSON.parse($('#fgBpTxt', host).value); } catch (e) { $('#fgBpMsg', host).textContent = 'Not valid JSON: ' + e.message; return; } if (!o || !o.page || !Array.isArray(o.sections)) { $('#fgBpMsg', host).textContent = 'A blueprint needs a page and a sections list.'; return; } o._facts = b.bp._facts; o._missing = []; b.override = o; const p = PLAN.pages.find(x => x.id === SEL); buildPage(p); openPage(SEL, true); toast('Edited blueprint compiled and screened'); };
        $('#fgBpDrop', host).onclick = () => { b.override = null; const p = PLAN.pages.find(x => x.id === SEL); buildPage(p); openPage(SEL, true); }; return; }
      const txt = TAB === 'elementor' ? JSON.stringify(b.r.template, null, 1) : TAB === 'schema' ? JSON.stringify(b.r.schema, null, 1) : b.r.html;
      host.innerHTML = `<pre class="fg-pre">${esc(txt)}</pre><div class="btnrow"><button type="button" class="btn sm" id="fgCopy">Copy</button></div>`; $('#fgCopy', host).onclick = () => copyText(txt);
    }
    wireSeg($('#fgStTabs', root), v => { TAB = v; renderPane(); });
    $('#fgStApply', root).onclick = () => { if (!SEL) return; const ed = { title: C.house($('#fgStTitle', root).value.trim()), h1: C.house($('#fgStH1', root).value.trim()), slug: slug($('#fgStSlug', root).value.trim()), meta: C.house($('#fgStMeta', root).value.trim()) }; Object.keys(ed).forEach(k => { if (!ed[k]) delete ed[k]; }); CFG.edits[SEL] = ed; const b = BUILT.get(SEL); if (b) b.override = null; save(); replan(); openPage(SEL, true); toast('Edits applied; they survive a full rebuild'); };
    $('#fgStReset', root).onclick = () => { if (!SEL) return; delete CFG.edits[SEL]; const b = BUILT.get(SEL); if (b) b.override = null; save(); replan(); openPage(SEL, true); };
    $('#fgStRemove', root).onclick = () => { if (!SEL) return; CFG.removed[SEL] = 1; BUILT.delete(SEL); save(); const l = (PLAN.pages.find(p => p.id === SEL) || {}).label; closeStudio(); replan(); toast('Removed ' + (l || 'page') + '; tick Show removed pages to restore it'); };
    const selB = () => SEL ? BUILT.get(SEL) : null;
    $('#fgStBp', root).onclick = () => { const b = selB(); if (b) saveFile(b.bp.page.slug + '.blueprint.json', JSON.stringify(stripBp(b.bp), null, 1)); else toast('Open a page first'); };
    $('#fgStEl', root).onclick = () => { const b = selB(); if (b) saveFile(b.bp.page.slug + '.elementor-template.json', JSON.stringify(b.r.template)); else toast('Open a page first'); };
    $('#fgStHtml', root).onclick = () => { const b = selB(); if (b) saveFile(b.bp.page.slug + '.preview.html', b.r.preview); else toast('Open a page first'); };
    $('#fgStBundle', root).onclick = () => { const b = selB(); if (!b) { toast('Open a page first'); return; } if (!FC) { toast('The compiler is not loaded'); return; } const bp = stripBp(b.bp); saveFile(b.bp.page.slug + '.bundle.json', JSON.stringify(FC.bundle(bp, {}, FC.compile(bp, {})))); };

    /* ---------- media: WebP in the browser, kept in IndexedDB ---------- */
    const IDB = {
      db: null,
      open() { if (this.db) return Promise.resolve(this.db); return new Promise((res, rej) => { try { if (typeof indexedDB === 'undefined') throw new Error('no IndexedDB'); const r = indexedDB.open('sev-forge', 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('assets')) r.result.createObjectStore('assets', { keyPath: 'id' }); }; r.onsuccess = () => { this.db = r.result; res(this.db); }; r.onerror = () => rej(r.error || new Error('IndexedDB refused')); r.onblocked = () => rej(new Error('IndexedDB blocked')); } catch (e) { rej(e); } }); },
      async tx(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('assets', mode); const st = t.objectStore('assets'); const out = fn(st); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('aborted')); }); },
      put(rec) { return this.tx('readwrite', st => st.put(rec)); }, del(id) { return this.tx('readwrite', st => st.delete(id)); },
      async all() { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction('assets', 'readonly').objectStore('assets').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); }); }
    };
    const persist = a => IDB.put({ id: a.id, file: a.file, kind: a.kind, mime: a.mime, w: a.w, h: a.h, alt: a.alt || '', name: a.name, size: a.size, blob: a.blob }).catch(e => { IDB_OK = false; renderMediaNote(e); });
    function renderMediaNote(e) { $('#fgMediaNote', root).textContent = IDB_OK ? `${N(ASSETS.length)} file${ASSETS.length === 1 ? '' : 's'} kept in this browser.` : `This browser does not allow storage here${e && e.message ? ' (' + e.message + ')' : ''}: photos are kept for this session only, so add them again after a reload.`; }
    const drop = $('#fgDrop', root), fileIn = $('#fgFile', root);
    drop.onclick = () => fileIn.click(); drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } };
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); addFiles([...(e.dataTransfer ? e.dataTransfer.files : [])]); }; fileIn.onchange = () => { addFiles([...fileIn.files]); fileIn.value = ''; };
    async function toWebp(f) {
      let bmp; try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch (e) { bmp = await createImageBitmap(f); }
      const r = Math.min(1, 1920 / Math.max(bmp.width, bmp.height)); const w = Math.round(bmp.width * r), h = Math.round(bmp.height * r);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(bmp, 0, 0, w, h); if (bmp.close) bmp.close();
      const blob = await new Promise(res => cv.toBlob(res, 'image/webp', 0.82)); return { blob, w, h, webp: !!(blob && blob.type === 'image/webp') };
    }
    async function addFiles(files) {
      for (const f of files) { try { const stem = f.name.replace(/\.[^.]+$/, ''); const ext = (f.name.match(/\.[^.]+$/) || [''])[0].toLowerCase(); let rec;
        if (f.type.startsWith('image/') && !/svg|gif/.test(f.type)) { const x = await toWebp(f); rec = { kind: 'image', blob: x.blob || f, w: x.w, h: x.h, mime: x.webp ? 'image/webp' : f.type, file: slug(stem) + (x.webp ? '.webp' : ext) }; }
        else if (f.type.startsWith('video/') || f.type.startsWith('image/')) rec = { kind: f.type.startsWith('video/') ? 'video' : 'image', blob: f, mime: f.type, file: slug(stem) + ext };
        else { toast('Not a photo or video: ' + f.name); continue; }
        let base = rec.file, n = 2; while (ASSETS.some(a => a.file === rec.file)) rec.file = base.replace(/(\.[^.]+)$/, '-' + (n++) + '$1');
        rec.id = uid('a'); rec.name = f.name; rec.size = rec.blob.size; rec.url = URL.createObjectURL(rec.blob); rec.alt = ''; ASSETS.push(rec); await persist(rec); } catch (e) { console.warn('asset', f.name, e); toast('Could not read ' + f.name); } }
      save(); renderMedia(); rebuildBuilt(); }
    function assignOptions(cur) { const ms = PLAN.markets; const F = FIRM.get();
      const opts = [['', 'Unassigned'], ['default', 'Site default hero']].concat((F.attorneys || []).map((a, i) => a.name ? ['atty:' + i, 'Headshot: ' + a.name] : null).filter(Boolean)).concat(Object.keys(KL).map(k => ['kind:' + k, 'All ' + KL[k].toLowerCase() + ' pages'])).concat(ms.counties.map(c => ['county:' + c.fips, c.name + ' County pages'])).concat(ms.cities.map(x => ['city:' + x.key, x.name + ' pages']));
      if (SEL) opts.push(['page:' + SEL, 'The page open in the studio']); if (cur && !opts.some(o => o[0] === cur)) opts.push([cur, cur.replace(/^page:/, 'Page ')]);
      return opts.map(o => `<option value="${esc(o[0])}" ${cur === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join(''); }
    function renderMedia() { const asg = CFG.media.assign; const rev = {}; for (const k in asg) rev[asg[k]] = k;
      $('#fgMediaRows', root).innerHTML = ASSETS.map(a => `<tr><td>${a.kind === 'image' ? `<img src="${esc(a.url)}" alt="" class="fg-thumb">` : pill('video')}</td><td class="fg-l">${esc(a.file)}${a.w ? ` <span class="small">${a.w} × ${a.h}</span>` : ''}</td><td>${N(a.size / 1024)} KB</td><td class="fg-l"><label class="fg-sr" for="fgAs_${a.id}">Assign ${esc(a.file)}</label><select id="fgAs_${a.id}" data-as="${a.id}">${assignOptions(rev[a.id] || '')}</select></td><td class="fg-l"><label class="fg-sr" for="fgAlt_${a.id}">Alt text for ${esc(a.file)}</label><input type="text" id="fgAlt_${a.id}" data-alt="${a.id}" value="${esc(a.alt || '')}" placeholder="what the photo shows"></td><td><button type="button" class="btn sm" data-del="${a.id}">Remove</button></td></tr>`).join('') || `<tr><td colspan="6" class="fg-l small">No assets yet. Without them, every image slot resolves from the site's media library at deploy.</td></tr>`;
      $$('select[data-as]', root).forEach(s => s.onchange = () => { const id = s.dataset.as; for (const k in asg) if (asg[k] === id) delete asg[k]; if (s.value) asg[s.value] = id; save(); rebuildBuilt(); });
      $$('input[data-alt]', root).forEach(i => i.onchange = () => { const a = ASSETS.find(x => x.id === i.dataset.alt); if (a) { a.alt = C.house(i.value.trim()); i.value = a.alt; persist(a); save(); } rebuildBuilt(); });
      $$('[data-del]', root).forEach(b => b.onclick = () => { const id = b.dataset.del; const a = ASSETS.find(x => x.id === id); if (a) URL.revokeObjectURL(a.url); ASSETS = ASSETS.filter(x => x.id !== id); for (const k in asg) if (asg[k] === id) delete asg[k]; IDB.del(id).catch(() => { }); save(); renderMedia(); rebuildBuilt(); });
      renderMediaNote(); }
    async function restoreMedia() { try { const rows = await IDB.all(); const known = new Set(ASSETS.map(a => a.id)); rows.forEach(r => { if (!r || known.has(r.id) || !r.blob) return; ASSETS.push(Object.assign({}, r, { url: URL.createObjectURL(r.blob) })); }); }
      catch (e) { IDB_OK = false; renderMediaNote(e); return; }
      if (ASSETS.length) { renderMedia(); rebuildBuilt(); } else renderMediaNote(); }

    /* ---------- deploy to WordPress ---------- */
    const WP = { base() { return ($('#fgdUrl', root).value || S().cms || E.site(CFG).url || '').trim().replace(/\/+$/, ''); }, auth() { return btoa(unescape(encodeURIComponent($('#fgdUser', root).value.trim() + ':' + $('#fgdPass', root).value.trim()))); },
      async req(method, path, body, raw) { const h = { Authorization: 'Basic ' + this.auth() }; if (body && !raw) h['Content-Type'] = 'application/json'; if (raw) { h['Content-Type'] = raw.mime; h['Content-Disposition'] = `attachment; filename="${raw.name}"`; }
        const r = await fetch(this.base() + '/wp-json/' + path.replace(/^\//, ''), { method, headers: h, body: body ? (raw ? body : JSON.stringify(body)) : undefined, mode: 'cors', credentials: 'omit' });
        let j = null; try { j = await r.json(); } catch (e) { } if (!r.ok) { const er = new Error((j && (j.message || j.code)) || ('HTTP ' + r.status)); er.status = r.status; throw er; } return j; } };
    const dlog = t => { const e = $('#fgdStatus', root); e.textContent = (/^Not connected\.$/.test(e.textContent) ? '' : e.textContent + '\n') + t; e.scrollTop = e.scrollHeight; };
    $('#fgdTest', root).onclick = async () => {
      $('#fgdNote', root).textContent = 'Testing…'; $('#fgdCors', root).hidden = true; $('#fgdStatus', root).textContent = '';
      if (ENV === 'viewer') { $('#fgdNote', root).textContent = 'Not available here.'; dlog('The hosted viewer blocks outbound connections. Download the pack, or deploy from the extension or the single file.'); $('#fgdCors', root).hidden = false; $('#fgdOrigin', root).textContent = location.origin; return; }
      if (!/^https?:\/\//.test(WP.base())) { $('#fgdNote', root).textContent = 'Enter the WordPress URL.'; return; }
      try { if (typeof CMS !== 'undefined' && CMS.ensureOrigin) { const g = await CMS.ensureOrigin(WP.base()); if (!g.granted) throw new Error('Site access to ' + g.origin + ' was not granted'); }
        const core = await (await fetch(WP.base() + '/wp-json/', { mode: 'cors', credentials: 'omit' })).json(); dlog(`Site: ${core.name || '?'}. REST reachable. Namespaces: ${(core.namespaces || []).filter(n => /wp\/v2|forge|elementor/.test(n)).join(', ')}`);
        if ((core.namespaces || []).includes('forge/v1')) { const s = await WP.req('GET', 'forge/v1/status'); WPSTAT = Object.assign({ bridge: true }, s); dlog(`Bridge ${s.forge} · WordPress ${s.wp} · PHP ${s.php} · Elementor ${s.elementor || 'none'} · containers ${s.containers ? 'on' : 'off'} · theme ${s.theme}\nSEO plugin: ${s.seo_plugin} · unfiltered_html ${s.unfiltered_html ? 'yes' : 'no, Elementor data cannot be written'} · user ${s.user}`); }
        else { const me = await WP.req('GET', 'wp/v2/users/me?context=edit'); WPSTAT = { bridge: false, user: me.slug }; dlog(`No FORGE bridge on this site. Signed in as ${me.slug}. Without the bridge only the HTML fallback and media can be sent, with no Elementor data, JSON LD or SEO fields.`); }
        $('#fgdNote', root).textContent = 'Connected.'; $('#fgdGo', root).disabled = false; ['#fgdLinks', '#fgdIdx', '#fgdLive'].forEach(s => $(s, root).disabled = !WPSTAT.bridge);
      } catch (e) { WPSTAT = null; $('#fgdGo', root).disabled = true; $('#fgdNote', root).textContent = 'Failed.'; dlog('Error: ' + (e.message || e)); if (e instanceof TypeError || /Failed to fetch|NetworkError|Load failed|not granted/.test(String(e))) { $('#fgdCors', root).hidden = false; $('#fgdOrigin', root).textContent = location.origin; } } };
    async function wpFind(q) { try { if (WPSTAT && WPSTAT.bridge) return await WP.req('GET', 'forge/v1/media/find?q=' + encodeURIComponent(q) + '&per_page=5'); const rows = await WP.req('GET', 'wp/v2/media?search=' + encodeURIComponent(q) + '&per_page=5&_fields=id,source_url,mime_type,alt_text,media_details'); return rows.map(r => ({ id: r.id, url: r.source_url, mime: r.mime_type, alt: r.alt_text || '', width: (r.media_details || {}).width, height: (r.media_details || {}).height })); } catch (e) { return []; } }
    async function wpUpload(a, alt) { const stem = a.file.replace(/\.[^.]+$/, ''); const hit = (await wpFind(stem)).find(m => m.url && m.url.split('/').pop().replace(/\.[^.]+$/, '').startsWith(stem)); if (hit) return Object.assign({ reused: true }, hit);
      const j = await WP.req('POST', 'wp/v2/media', a.blob, { mime: a.mime, name: a.file }); try { await WP.req('POST', 'wp/v2/media/' + j.id, { alt_text: alt || a.alt || '', title: stem.replace(/-/g, ' ') }); } catch (e) { } const det = j.media_details || {}; return { id: j.id, url: j.source_url, width: det.width || a.w, height: det.height || a.h, mime: j.mime_type }; }
    async function resolveMedia(bp, notes) { const out = {}; const doMedia = $('#fgdMedia', root).checked;
      for (const [k, spec] of Object.entries(bp.media || {})) { const src = spec.source || '';
        if (/^https?:/.test(src) && spec.kind === 'video') { out[k] = { id: 0, url: src, alt: spec.alt, kind: 'video' }; continue; }
        if (src.startsWith('assets/')) { const a = ASSETS.find(x => x.file === src.slice(7)); if (!a) { notes.push(k + ': asset not loaded'); continue; } if (!doMedia) { notes.push(k + ': upload skipped'); continue; } try { if (!a.remote) a.remote = await wpUpload(a, a.alt || spec.alt); out[k] = Object.assign({}, a.remote, { alt: a.alt || spec.alt, kind: a.kind }); } catch (e) { notes.push(k + ': upload failed, ' + e.message); } continue; }
        if (src.startsWith('library:') && doMedia) { const m = (await wpFind(src.slice(8))).find(h => !h.mime || h.mime.startsWith(spec.kind === 'video' ? 'video' : 'image')); if (m) out[k] = { id: m.id, url: m.url, alt: spec.alt || m.alt, kind: spec.kind || 'image', width: m.width, height: m.height }; else notes.push(k + ': no library match for "' + src.slice(8) + '"'); } }
      return out; }
    $('#fgdGo', root).onclick = () => { if (!WPSTAT) return; ensureBuilt(); renderLedger(); if ($('#fgdPublish', root).checked && !PUBLISH_OK) { $('#fgdConfirmT', root).textContent = `Publish ${PLAN.pages.length} pages live on ${WP.base()}? Drafts are the safe default, and the firm should read each page first.`; $('#fgdConfirm', root).hidden = false; return; } deployAll(); };
    $('#fgdConfirmGo', root).onclick = () => { PUBLISH_OK = true; $('#fgdConfirm', root).hidden = true; deployAll(); };
    $('#fgdConfirmNo', root).onclick = () => { $('#fgdPublish', root).checked = false; $('#fgdConfirm', root).hidden = true; deployAll(); };
    async function deployAll() {
      const publish = $('#fgdPublish', root).checked && PUBLISH_OK; const btn = $('#fgdGo', root); btn.disabled = true; const tb = $('#fgdRes', root); tb.innerHTML = ''; const onlyNew = $('#fgdOnlyNew', root).checked; let done = 0;
      const todo = PLAN.pages.filter(p => !(onlyNew && DEPLOYED.has(p.id) && DEPLOYED.get(p.id).id));
      for (const p of todo) { const b = BUILT.get(p.id) || buildPage(p); const notes = []; const row = el('tr', null, `<td class="fg-l">${esc(p.label)}</td><td class="fg-l">…</td><td class="fg-l"></td><td class="fg-l"></td><td></td><td class="fg-l"></td>`); tb.appendChild(row);
        try { if (b.ch.block) throw new Error('needs review, blocked by the compliance screen: ' + [...new Set(b.ch.issues.filter(i => i.sev === 'block').map(i => i.id))].join(', '));
          const bp = stripBp(b.bp); const mp = await resolveMedia(bp, notes); const un = Object.keys(bp.media || {}).filter(k => !mp[k]); if (un.length) throw new Error('media unresolved: ' + un.join(', ') + '. Add an asset or a matching library image');
          const r = compile(bp, mp); const bl = (r.lint || r.warnings || []).find(l => /^BLOCK/.test(l)); if (bl) throw new Error(bl);
          let res; if (WPSTAT.bridge) { const bundle = FC.bundle(bp, mp, r); bundle.status = publish ? 'publish' : 'draft'; res = await WP.req('POST', 'forge/v1/import', bundle); }
          else { const pt = bp.page.post_type === 'post' ? 'posts' : 'pages'; const ex = await WP.req('GET', `wp/v2/${pt}?slug=${encodeURIComponent(p.slug)}&status=any&_fields=id`); const body = { slug: p.slug, title: p.h1, status: publish ? 'publish' : 'draft', content: r.html, excerpt: bp.page.summary || '' }; const j = await WP.req('POST', ex.length ? `wp/v2/${pt}/${ex[0].id}` : `wp/v2/${pt}`, body); res = { id: j.id, link: j.link, edit: WP.base() + '/wp-admin/post.php?post=' + j.id + '&action=edit', status: body.status, updated: !!ex.length }; }
          DEPLOYED.set(p.id, { id: res.id, link: res.link, edit: res.edit, status: res.status || (publish ? 'publish' : 'draft'), note: notes.join('; ') });
          row.children[1].innerHTML = pill((res.status || 'draft') + (res.updated ? ' · updated' : ''), 'p-ok'); row.children[2].innerHTML = res.link ? `<a href="${esc(res.link)}" target="_blank" rel="noopener">${esc(res.link)}</a>` : ''; row.children[3].innerHTML = res.edit ? `<a href="${esc(res.edit)}" target="_blank" rel="noopener">Edit</a>` : ''; row.children[4].textContent = Object.keys(mp).length; row.children[5].textContent = notes.join('; ');
        } catch (e) { DEPLOYED.set(p.id, { status: 'error', note: e.message }); row.children[1].innerHTML = pill('error', 'p-block'); row.children[5].textContent = e.message + (notes.length ? ' · ' + notes.join('; ') : ''); }
        done++; }
      saveDeployed(); btn.disabled = false; renderLedger(); dlog(`Deployed ${done} pages${publish ? ', published' : ' as drafts'}.`); }
    $('#fgdLive', root).onclick = async () => { try { const j = await WP.req('GET', 'forge/v1/urls'); const txt = (j.urls || []).join('\n'); $('#fgLive', root).value = txt; S().live = txt; LIVE = E.parseLive(txt, E.site(CFG).url); save(); renderLive(); rebuildBuilt(); dlog(`Live URLs refreshed from the site: ${j.count || (j.urls || []).length}.`); } catch (e) { dlog('Could not read live URLs: ' + e.message); } };
    $('#fgdLinks', root).onclick = async () => { try { const j = await WP.req('GET', 'forge/v1/urls'); const live = new Set((j.urls || []).map(u => { try { return new URL(u).pathname.replace(/\/?$/, '/'); } catch (e) { return u; } })); let bad = 0, tot = 0; PLAN.pages.forEach(p => { const b = BUILT.get(p.id); if (!b) return; b.bp.page.internal_links.forEach(l => { tot++; if (!live.has(l.url.replace(/\/?$/, '/'))) bad++; }); }); dlog(`Live URLs on the site: ${live.size}. Internal links in the plan: ${tot}; not live: ${bad}${bad ? '. Refresh the live URLs and rebuild before publishing' : ''}.`); } catch (e) { dlog('Link check failed: ' + e.message); } };
    $('#fgdIdx', root).onclick = async () => { const urls = [...DEPLOYED.values()].filter(d => d.status === 'publish' && d.link).map(d => d.link); if (!urls.length) { dlog('Nothing published yet.'); return; } try { const j = await WP.req('POST', 'forge/v1/indexnow', { urls }); dlog(`IndexNow: ${j.sent} URLs sent, response ${j.code}.`); } catch (e) { dlog('IndexNow failed: ' + e.message + '. Set an IndexNow key in the bridge settings first.'); } };

    /* ---------- exports ---------- */
    const ymd = () => todayISO();
    function cliText() { const s = E.site(CFG).url || 'https://www.example.com'; const first = PLAN.pages[0] ? PLAN.pages[0].slug : 'home';
      return `export WP_URL=${S().cms || s} WP_USER=<user> WP_APP_PASS='<application password>'
python3 forge_wp.py status
python3 forge_wp.py bridge-zip
for f in pack/blueprints/*.blueprint.json; do s=$(basename $f .blueprint.json); python3 forge_wp.py media-resolve $f pack/media/$s.media.json --assets pack --reuse && python3 forge_compile.py $f out --media pack/media/$s.media.json && python3 forge_wp.py links-check $f --base ${s} && python3 forge_wp.py import out/$s.bundle.json --media pack/media/$s.media.json; done
# one page: python3 forge_compile.py pack/blueprints/${first}.blueprint.json out
# pages under pack/needs-review are not ready: fix the findings in Site Forge and export again`; }
    const findingsOf = b => ({ slug: b.bp.page.slug, status: 'needs review', block: b.ch.block, review: b.ch.warn, findings: b.ch.issues.filter(i => i.sev !== 'note').map(i => ({ id: i.id, sev: i.sev, where: i.where, hit: i.ev, title: i.msg, rule: i.cite, fix: i.fix })) });
    function ledgerCSV() { ensureBuilt(); return toCSV(['type', 'label', 'slug', 'title', 'title_len', 'h1', 'meta', 'meta_len', 'words', 'blocks', 'review', 'internal_links', 'status', 'deploy_status', 'link'], PLAN.pages.map(p => { const b = BUILT.get(p.id); const d = DEPLOYED.get(p.id) || {}; return [KL[p.kind], p.label, '/' + p.slug + '/', p.title, p.title.length, p.h1, p.meta, p.meta.length, b.words, b.ch.block, b.ch.warn, b.bp.page.internal_links.length, isBlocked(b) ? 'needs review' : 'ready', d.status || '', d.link || '']; }), `Site Forge ledger · ${FIRM.get().name || '[Firm name]'} · ${ymd()} · status "needs review" means a blocking compliance finding`); }
    async function assetBytes(a) { return new Uint8Array(await a.blob.arrayBuffer()); }
    const dirFor = (b, d) => (isBlocked(b) ? 'needs-review/' : '') + d;
    $('#fgPack', root).onclick = async () => { if (!FC) { toast('The compiler is not loaded'); return; } ensureBuilt(); renderKpis(); renderLedger(); const files = []; const ready = PLAN.pages.filter(p => !isBlocked(BUILT.get(p.id))).length;
      const planJ = { v: 1, saved: new Date().toISOString(), cfg: CFG, deployed: [...DEPLOYED.entries()], pages: PLAN.pages.map(p => ({ id: p.id, kind: p.kind, slug: p.slug, title: p.title, h1: p.h1, meta: p.meta, label: p.label, lang: p.lang, status: isBlocked(BUILT.get(p.id)) ? 'needs review' : 'ready' })) };
      files.push({ name: 'pack/plan.json', data: JSON.stringify(planJ, null, 1) });
      files.push({ name: 'pack/README.md', data: `# Site Forge pack\n\n${PLAN.pages.length} pages for ${FIRM.get().name || '[Firm name]'}, built ${ymd()} by Severance, module 21. ${ready} ready, ${PLAN.pages.length - ready} need review.\n\nFolders: blueprints (source of truth), bundles (what the bridge imports, media unresolved), elementor (templates for Templates, Saved Templates, Import), html (semantic fallback), preview (open in a browser), schema (JSON LD), assets (WebP images and video), media (per page media maps to fill). Pages with a blocking compliance finding sit under needs-review with a findings file; they are not ready to publish. forge-bridge.php is the WordPress plugin.\n\nInternal links point only at URLs that were live on the pasted sitemap. Re-run links-check before publishing. Every page is attorney advertising: the responsible lawyer reads it before it goes live, and the firm files with the Advertising Review Committee as Rule 7.04 requires.\n\n\`\`\`\n${cliText()}\n\`\`\`\n` });
      files.push({ name: 'pack/forge-bridge.php', data: typeof FORGE_BRIDGE_PHP !== 'undefined' ? FORGE_BRIDGE_PHP : '' }); files.push({ name: 'pack/ledger.csv', data: ledgerCSV() });
      for (const p of PLAN.pages) { const b = BUILT.get(p.id); const bp = stripBp(b.bp); const r0 = FC.compile(bp, {}); const D0 = d => 'pack/' + dirFor(b, d);
        files.push({ name: `${D0('blueprints')}/${p.slug}.blueprint.json`, data: JSON.stringify(bp, null, 1) }); files.push({ name: `${D0('bundles')}/${p.slug}.bundle.json`, data: JSON.stringify(Object.assign(FC.bundle(bp, {}, r0), isBlocked(b) ? { status: 'needs review' } : {})) }); files.push({ name: `${D0('elementor')}/${p.slug}.elementor-template.json`, data: JSON.stringify(r0.template) }); files.push({ name: `${D0('html')}/${p.slug}.content.html`, data: r0.html }); files.push({ name: `${D0('preview')}/${p.slug}.preview.html`, data: r0.preview }); files.push({ name: `${D0('schema')}/${p.slug}.schema.json`, data: JSON.stringify(r0.schema, null, 1) }); files.push({ name: `${D0('media')}/${p.slug}.media.json`, data: '{}' });
        if (isBlocked(b)) files.push({ name: `pack/needs-review/${p.slug}.findings.json`, data: JSON.stringify(findingsOf(b), null, 1) }); }
      for (const a of ASSETS) { try { files.push({ name: 'pack/assets/' + a.file, data: await assetBytes(a) }); } catch (e) { } }
      saveFile(`site-forge-pack_${slug(FIRM.get().name || 'site')}_${ymd()}.zip`, zipBlob(files)); };
    $('#fgElZ', root).onclick = () => { ensureBuilt(); const files = []; PLAN.pages.forEach(p => { const b = BUILT.get(p.id); files.push({ name: `${dirFor(b, 'elementor')}/${p.slug}.elementor-template.json`, data: JSON.stringify(b.r.template) }); if (isBlocked(b)) files.push({ name: `needs-review/${p.slug}.findings.json`, data: JSON.stringify(findingsOf(b), null, 1) }); }); saveFile('site-forge-elementor-templates.zip', zipBlob(files)); };
    $('#fgBpZ', root).onclick = () => { ensureBuilt(); const files = []; PLAN.pages.forEach(p => { const b = BUILT.get(p.id); files.push({ name: `${dirFor(b, 'blueprints')}/${p.slug}.blueprint.json`, data: JSON.stringify(stripBp(b.bp), null, 1) }); if (isBlocked(b)) files.push({ name: `needs-review/${p.slug}.findings.json`, data: JSON.stringify(findingsOf(b), null, 1) }); }); saveFile('site-forge-blueprints.zip', zipBlob(files)); };
    $('#fgBridge', root).onclick = () => { if (typeof FORGE_BRIDGE_PHP === 'undefined') { toast('The bridge plugin source is not loaded (src/05_forge_bridge_raw.js)'); return; } saveFile('forge-bridge.zip', zipBlob([{ name: 'forge-bridge/forge-bridge.php', data: FORGE_BRIDGE_PHP }])); };
    $('#fgLedX', root).onclick = () => saveFile('site-forge-ledger.csv', ledgerCSV());
    $('#fgSave', root).onclick = () => { readSite(); readFocus(); saveFile(`site-forge-plan_${slug(FIRM.get().name || 'site')}.json`, JSON.stringify({ v: 1, saved: new Date().toISOString(), cfg: CFG, deployed: [...DEPLOYED.entries()] }, null, 1)); };
    $('#fgLoad', root).onclick = () => $('#fgLoadF', root).click();
    $('#fgLoadF', root).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const o = JSON.parse(await readText(f)); const c = o.cfg || o; if (!c || typeof c !== 'object' || !(c.site || c.focus || c.build)) throw new Error('no site, focus or build section'); CFG = merge(E.defaultCfg(), c); CFG.media.assets = []; if (o.deployed) { DEPLOYED = new Map(o.deployed); saveDeployed(); } LIVE = E.parseLive(CFG.site.live, E.site(CFG).url); BUILT = new Map(); writeSite(); syncFocus(); syncBuild(); $('#fgLive', root).value = CFG.site.live || ''; renderLive(); save(); replan(); renderMedia(); toast('Plan loaded'); } catch (err) { toast('Not a Site Forge plan: ' + err.message); } e.target.value = ''; };
    $('#fgSend', root).onclick = () => { ensureBuilt(); renderKpis(); renderLedger(); goModule('publish', { from: 'forge' }); };

    /* ---------- method ---------- */
    function renderMethod() {
      const V = E.baseVars(CFG, PLAN.markets); const lawRows = Object.keys(LAW).filter(k => !['pcts', 'gray50', 'e911'].includes(k)).map(k => [esc(LAW[k].v), esc(LAW[k].l), esc(LAW[k].c), gradeB(LAW[k].g || 'A')]);
      const dataRows = [['per county', 'divorce petitions (with and without children), custody suits, modifications, enforcements, protective orders, child support and paternity, adoption and CPS cases, last 12 months and the year before; pending and disposed divorces where a monthly series exists', `Texas Office of Court Administration, court activity reports through ${esc(V.through)}`, gradeB('A')], ['per county', 'courthouse where family cases are heard (the six largest metros)', 'Severance Metro Atlas, placed from street addresses', gradeB('B')], ['per city', 'divorce petitions a year estimated for the city\'s ZIP codes', 'County filings allocated to ZIP codes by married adults and the modeled hazard', gradeB('C')], ['per city', 'married adults in the city\'s ZIP codes', 'U.S. Census Bureau, American Community Survey 2020 to 2024', gradeB('B')]];
      const list = items => `<ul class="fg-list">${items.map(([h, t]) => `<li><b>${esc(h)}.</b> ${t}</li>`).join('')}</ul>`;
      $('#fgMethod', root).innerHTML = `<div class="grid2"><div>${list([
        ['Pages', 'Each page is a FORGE blueprint: one JSON document naming the archetype, the entity, the call to action and form, the media slots and an ordered list of sections. The same blueprint compiles to Elementor flex containers, semantic HTML and JSON LD here and in the FORGE skill\'s Python compiler.'],
        ['Copy', `Practice copy is written per service line, the same lines the Campaign Desk advertises, in Texas terms first (conservatorship, possession and access, SAPCR) with the lay word beside them. County and city pages are written from that place's own court filings, courthouse and ZIP numbers; guides from the Office of Court Administration reports through ${esc(V.through)} and the Family Code. Spanish landing pages use the TexasLawHelp.org terms: divorcio, custodia, manutención de menores, orden de protección, posesión y acceso.`],
        ['No invented numbers', 'Templates hold no figures. Every number on a page comes from the data (with its source printed beside it) or from the statute table below (with its cite); the unit test checks that every number a page prints exists in the data passed to the writer.'],
        ['Standard', 'Title of 60 characters or fewer, meta of 120 to 158, one H1 of 70 or fewer, an answer capsule under the hero, sourced key facts, a FAQ of real questions, a primary call to action with the phone, a sticky mobile bar, a consent form with an unchecked box and a no confidential details note, the responsible attorney and primary office in the trust strip and the notice on every page.'],
        ['Links', 'Internal links come only from the live URLs pasted in step 4, scored by how well the path matches the page\'s line and place. Pages in the plan link to each other only after they are live. Breadcrumbs name Home only when the home page is on the live list.'],
        ['Checks', 'Every visible field runs the compliance engine (Rules 7.01 to 7.06, the family law myths, stale numbers, placeholders, the house style), the page as a whole runs the Rule 7.02(a) check, and the compiler adds its structural checks. A block marks the page needs review: it is exported under needs-review with its findings, never as ready, and deploys refuse it.']])}</div>
        <div><div class="tblwrap" style="max-height:420px"><table class="t fg-prose"><thead><tr><th>Value</th><th>Fact as printed</th><th>Source printed on the page</th><th>Grade</th></tr></thead><tbody>${lawRows.concat(dataRows).map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>
        ${callout('judg', 'Judgment calls to check before publishing', list([
          ['The firm profile is the only source about the firm', 'Name, lawyers, bar numbers, offices, hours, consultation terms and payment options print exactly as entered. Defaults the profile opens with (office hours, the consultation fee, payment options) are placeholders until the firm confirms them.'],
          ['Practice estimates are labeled', 'The usual length of an agreed or a contested divorce is a practice estimate, not a statute; it is graded C and worded as usual, never as a promise.'],
          ['City figures are allocations', 'The Office of Court Administration counts filings by county. City pages print an estimate of the county\'s filings allocated to the city\'s ZIP codes, worded as an estimate and graded C.'],
          ['Courthouses', 'Courthouse names and addresses come from the Metro Atlas files for the six largest metros; other counties carry no courthouse line rather than a guess.'],
          ['No reviews, no ratings, no results', 'The forge writes no testimonial, no case result and no rating, and puts no aggregateRating in the schema. Paste real reviews with permission to show them.'],
          ['Specialty wording', 'Only a lawyer\'s Texas Board of Legal Specialization certification is printed as a specialty, in the exact form Board Certified, area, Texas Board of Legal Specialization. Nothing else on a page says specialist or expert.'],
          ['Landing pages are noindex', 'Campaign landing pages duplicate the intent of the practice and city pages; they stay out of the index unless you untick the option.'],
          ['Slugs keep hyphens', 'URL slugs use hyphens as separators, which is how WordPress builds them; no hyphen appears in visible copy.']]))}
        ${callout('note', 'Hand off to the FORGE skill and to Publish', `Send to Publish hands every built page, with its photos, to module 22 for WordPress, headless WordPress, Drupal, Wix, Duda, Webflow, Shopify, HubSpot, Joomla or Ghost. Or download the pack, unzip it beside the FORGE toolkit and run the commands in its README: it resolves media, checks every internal link against the live sitemap and imports each page as a draft through the bridge. The pack's plan.json reloads here with Load.<pre class="fg-pre">${esc(cliText())}</pre>`)}
        <h4 class="fh">Sources</h4><ul class="fg-list"><li><b>Court filings.</b> Texas Office of Court Administration, Court Activity Reporting and Directory System. <a href="https://card.txcourts.gov/" target="_blank" rel="noopener">card.txcourts.gov</a></li><li><b>Family law.</b> Texas Family Code. <a href="https://statutes.capitol.texas.gov/" target="_blank" rel="noopener">statutes.capitol.texas.gov</a></li><li><b>Child support guideline cap.</b> Office of the Attorney General adjustment effective September 1, 2025. <a href="https://www.texasattorneygeneral.gov/child-support" target="_blank" rel="noopener">texasattorneygeneral.gov</a></li><li><b>Advertising rules.</b> Texas Disciplinary Rules of Professional Conduct, Part VII. <a href="https://www.texasbar.com/" target="_blank" rel="noopener">texasbar.com</a></li><li><b>Spanish legal terms.</b> TexasLawHelp.org. <a href="https://texaslawhelp.org/es" target="_blank" rel="noopener">texaslawhelp.org/es</a></li><li><b>Married adults.</b> U.S. Census Bureau, American Community Survey 2020 to 2024.</li><li><b>Schema.</b> schema.org LegalService and Attorney. <a href="https://schema.org/LegalService" target="_blank" rel="noopener">schema.org</a></li></ul>`;
    }

    /* ---------- hooks for the rest of the atlas ---------- */
    this.receive = p => { if (!p || p.from === 'forge') return; let n = 0;
      if (Array.isArray(p.counties) && p.counties.length) { const fs = p.counties.filter(f => CI[f]); if (fs.length) { CFG.focus.scope = 'pick'; CFG.focus.counties = fs; n += fs.length; } }
      let keys = []; if (Array.isArray(p.zips) && p.zips.length) keys = citiesFromZips(p.zips); if (Array.isArray(p.cities) && p.cities.length) keys = keys.concat(citiesByName(p.cities));
      if (keys.length) { CFG.focus.cscope = 'pick'; CFG.focus.cpicks = [...new Set(keys)]; n += keys.length; }
      if (n) { syncFocus(); save(); replan(); toast(`${keys.length ? keys.length + ' cities' : ''}${keys.length && p.counties ? ' and ' : ''}${p.counties ? (p.counties.length + ' counties') : ''} received`); } };
    this.feed = () => { ensureBuilt(); return PLAN.pages.map(p => { const b = BUILT.get(p.id); return { label: `Site Forge · ${KL[p.kind]} · ${p.label}`, text: C.visibleText(b.bp).map(x => x[1]).join('\n'), html: b.r.html + '\n' + JSON.stringify(b.r.schema), plat: 'web', kind: 'page', lang: p.lang, page: true }; }); };
    this.onShow = () => { renderFirm(); };
    /* the hand off to module 22 (Publish): every built page as a portable page with its media, for any CMS */
    this.publishPages = () => { ensureBuilt(); return PLAN.pages.map(p => { const b = BUILT.get(p.id); const bp = stripBp(b.bp); const media = {}, forCompile = {};
        for (const [k, spec] of Object.entries(bp.media || {})) { const src = spec.source || '';
          if (/^https?:/.test(src)) { media[k] = forCompile[k] = { id: 0, url: src, alt: spec.alt || '', kind: spec.kind || 'video' }; }
          else if (src.startsWith('assets/')) { const a = ASSETS.find(x => x.file === src.slice(7)); if (a) { forCompile[k] = { id: 0, url: a.url, alt: a.alt || spec.alt || '', kind: a.kind, width: a.w, height: a.h }; media[k] = Object.assign({}, forCompile[k], { mime: a.mime, asset: { blob: a.blob, file: a.file, mime: a.mime } }); } else media[k] = { id: 0, url: '', alt: spec.alt || '', kind: spec.kind || 'image', missing: src }; }
          else if (src.startsWith('library:')) media[k] = { id: 0, url: '', alt: spec.alt || '', kind: spec.kind || 'image', library: src.slice(8) }; }
        const r = compile(bp, forCompile); const blockLines = b.ch.issues.filter(i => i.sev === 'block').map(i => `BLOCK: needs review, ${i.id} ${i.msg} (${i.where})`);
        const extra = { label: p.label, kind: KL[p.kind], forgeId: p.id, checks: b.ch, words: b.words, ready: !isBlocked(b), review_status: isBlocked(b) ? 'needs review' : 'ready', findings: isBlocked(b) ? findingsOf(b).findings : [], lint: (r.lint || r.warnings || []).concat(blockLines) };
        /* the portable blueprint (law firm sections lowered to what every CMS and the headless kit render) through FORGE_COMPILE.pageFor */
        if (FC && typeof FC.pageFor === 'function' && typeof CMS !== 'undefined') return FC.pageFor(bp, r, media, extra);
        return typeof CMS !== 'undefined' && CMS.pageFromForge ? CMS.pageFromForge(r.portable || bp, r, media, extra) : Object.assign({ slug: bp.page.slug, title: bp.page.title, html: r.html, schema: r.schema, blueprint: r.portable || bp, media }, extra); }); };
    this.publishAssets = () => ASSETS.slice();
    this.publishSite = () => Object.assign({}, E.site(CFG), { firm: FIRM.get().name || '', responsible: FIRM.responsible().name || '', office: FIRM.primary().city || '' });

    /* ---------- boot ---------- */
    if (!SFORGE._bus) { SFORGE._bus = true; BUS.on('firm', () => { const m = MODI.forge; if (m && m._onFirm) m._onFirm(); }); }
    this._onFirm = () => { writeSite(); syncBuild(); renderFirm(); replan(); renderMethod(); };
    writeSite(); syncFocus(); syncBuild(); $('#fgLive', root).value = S().live || ''; renderLive(); $('#fgdUrl', root).value = S().cms || E.site(CFG).url || '';
    ASSETS = []; replan(); renderMedia(); renderMethod();
    PLAN.pages.forEach(p => buildPage(p)); renderKpis(); renderLedger();
    if (PLAN.pages.length) { const first = PLAN.pages.find(p => p.kind === 'county') || PLAN.pages.find(p => p.kind === 'practice') || PLAN.pages[0]; openPage(first.id, true); }
    restoreMedia(); void BUILT_ONCE; void self;
  }
});
