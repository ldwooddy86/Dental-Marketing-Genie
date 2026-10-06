/* ==== m09_forge ==== */
"use strict";
/* ============================ Module 9: Site Forge (HVAC) ============================ */
/* FORGE plans the page set from the city model, writes each page as a FORGE blueprint from FCOPY and the atlas numbers,
   lints it with the Satchel rule pack, and hands it to FORGE_COMPILE (Elementor, semantic HTML, JSON-LD, preview). */
const FORGE = (() => {
  const C = FCOPY;
  const KL = { home: 'Home', about: 'About', service: 'Service', county: 'County hub', city: 'City', landing: 'Landing', guide: 'Guide' };
  const LAM = WB.AC_TX.lam, KW = WB.AC_TX.k, WA = META.weib_all;
  const mrl = a => weibMRL(a, LAM, KW);
  const T = DATA.tickets, CL = DATA.climate;
  const CITY = {}; CITIES.forEach(c => CITY[c.name] = c);
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fmtDate = s => { const [y, m, d] = String(s).split('-').map(Number); return `${MON[m - 1]} ${d}, ${y}`; };
  const fmtMD = s => { const [, m, d] = String(s).split('-').map(Number); return `${MON[m - 1]} ${d}`; };
  const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  const listAnd = a => { a = a.filter(Boolean); return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; };
  const tcase = s => String(s).toLowerCase().replace(/\b[a-z]/g, m => m.toUpperCase()).replace(/\bArpt\b/g, 'Airport').replace(/\bMuni\b/g, 'Municipal');
  const hav = (a, b, c, d) => { const t = Math.PI / 180; const x = Math.sin((c - a) * t / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin((d - b) * t / 2) ** 2; return 2 * 3958.8 * Math.asin(Math.sqrt(x)); };
  const strip = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = s => (strip(s).match(/\S+/g) || []).length;
  const pct0 = v => isN(v) ? Math.round(v) + '%' : null;
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  function cleanInline(s) { const m = String(s).match(/^(\s*)([\s\S]*?)(\s*)$/); return m[1] + houseClean(m[2]) + m[3]; }
  function cleanHTML(h) { return String(h).split(/(<[^>]+>)/).map(p => p.startsWith('<') ? p : (p.trim() ? cleanInline(p) : p)).join(''); }
  const TEXT_KEYS = new Set(['eyebrow', 'lede', 'body', 'text', 'heading', 'caption', 'title', 'label', 'q', 'a', 'quote', 'role', 'value', 'source', 'anchor', 'description', 'transcript', 'link', 'name']);
  function cleanDeep(x, key) {
    if (typeof x === 'string') return key === 'html' ? cleanHTML(x) : TEXT_KEYS.has(key) ? houseClean(x) : x;
    if (Array.isArray(x)) return x.map(v => cleanDeep(v, key === 'rows' || key === 'columns' ? 'text' : key));
    if (x && typeof x === 'object') { const o = {}; for (const k in x) o[k] = (k === 'url' || k === 'media' || k === 'id' || k === 'type') ? x[k] : cleanDeep(x[k], k); return o; }
    return x;
  }
  function fill(t, V, missing) {
    if (t == null || typeof t !== 'string') return t;
    return t.replace(/\{([a-zA-Z_]\w*)\}/g, (m, k) => { if (V[k] != null && V[k] !== '') return String(V[k]); if (missing && !missing.includes(k)) missing.push(k); return ''; })
      .replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').replace(/\(\s*\)/g, '').trim();
  }
  function fillDeep(x, V, missing) { if (typeof x === 'string') return fill(x, V, missing); if (Array.isArray(x)) return x.map(y => fillDeep(y, V, missing)); if (x && typeof x === 'object') { const o = {}; for (const k in x) o[k] = fillDeep(x[k], V, missing); return o; } return x; }

  /* ---------- climate and model constants ---------- */
  const ci = k => CL.cols.indexOf(k);
  const YTD = CL.ytd; const curY = +String(YTD.through).slice(0, 4);
  const PAST = CL.rows.filter(r => r[0] !== curY); const CUR = CL.rows.find(r => r[0] === curY) || CL.rows[CL.rows.length - 1];
  const above = PAST.filter(r => r[ci('d100')] > YTD.d100).length, ties = PAST.filter(r => r[ci('d100')] === YTD.d100).map(r => r[0]);
  const REC = PAST.reduce((m, r) => r[ci('d100')] > m[ci('d100')] ? r : m, PAST[0]);
  const RANK100 = `${above === 0 ? 'already the most' : 'the ' + (ORD[above] || (above + 1) + 'th') + ' most'} of any year since ${CL.rows[0][0]}${ties.length ? ', tied with ' + listAnd(ties.map(String)) : ''}`;
  const FWH = DATA.ts && DATA.ts['Fort Worth'] ? (Math.exp(DATA.ts['Fort Worth'].b_cdd100) - 1) * 100 : null;
  const HAILBIG = {}; (DATA.hail.big || []).forEach(([d, place, cty, sz]) => { if (!HAILBIG[cty] || sz > HAILBIG[cty][3]) HAILBIG[cty] = [d, place, cty, sz]; });
  const AQ = { repair: 'Why do air conditioners fail in North Texas?', replace: 'What does replacing an AC system involve?', firstwave: 'When does a builder original system need replacing?', r22: 'What should I do about an R22 system?', furnace: 'How long does a gas furnace last in North Texas?', heatpump: 'How does a heat pump work, and why does it wear faster?', hail: 'How does hail damage an AC unit?', duct: 'Why do attic ducts fail?', landlord: 'How do you handle HVAC for rental homes?', newowner: 'What does a new homeowner HVAC check tell you?', premium: 'What does a variable speed system do differently?', financing: 'How does HVAC financing work?', maint: 'What does the maintenance plan include?', recruit: 'Who are we hiring?' };
  const TOK = { repair: ['repair', 'service', 'fix', 'not-cooling'], replace: ['replacement', 'replace', 'install', 'installation', 'new-ac', 'system'], firstwave: ['replacement', 'replace', 'builder'], r22: ['r22', 'freon', 'refrigerant'], furnace: ['furnace', 'heating', 'heater', 'heat'], heatpump: ['heat-pump', 'heatpump', 'heat-pumps'], hail: ['hail', 'storm', 'insurance'], duct: ['duct', 'ductwork', 'ducts', 'air-duct'], landlord: ['property', 'rental', 'landlord', 'commercial', 'management'], newowner: ['inspection', 'new-home', 'buyer', 'checkup'], premium: ['variable', 'efficiency', 'high-efficiency', 'seer', 'two-stage'], financing: ['financing', 'finance', 'payment', 'credit'], maint: ['maintenance', 'tune', 'plan', 'club', 'membership', 'agreement'], recruit: ['careers', 'career', 'jobs', 'employment', 'hiring'] };
  const BAND = { repair: 'Book an AC repair visit', replace: 'Book a replacement quote visit', firstwave: 'Book a home visit for your first replacement', r22: 'Book an R22 system check', furnace: 'Book a furnace visit', heatpump: 'Book a heat pump visit', hail: 'Book a hail damage inspection', duct: 'Book a duct test and quote', landlord: 'Set up service for your rentals', newowner: 'Book a new homeowner check', premium: 'Book a variable speed quote visit', financing: 'Book a replacement quote with financing options', maint: 'Join the {plan}', recruit: 'Apply in two minutes' };
  const firstSentence = s => { const m = String(s).match(/^[\s\S]*?[.!?](?=\s|$)/); return (m ? m[0] : String(s)).trim(); };
  const CUSTOMER = ANGLES.filter(a => a.id !== 'recruit').map(a => a.id);
  const TOPICS = C.GUIDES.map(g => g.id);

  function defaultCfg() {
    const b = BENCH || {};
    return {
      v: 1,
      site: { brand: BRAND.name || b.name || 'Your Company', url: BRAND.url || (b.domain ? 'https://www.' + b.domain : 'https://www.example.com'), cms: '', phone: BRAND.phone || (b.phone ? phoneFmt(b.phone) : ''), email: BRAND.email || '', street: houseClean(String(BRAND.street || b.street || '').replace(/\bSte\b\.?/i, 'Suite')), city: BRAND.city || b.city || 'Dallas', zip: BRAND.zip || b.zip || '', lat: BRAND.lat || b.lat || null, lon: BRAND.lon || b.lon || null,
        lic: BRAND.lic || 'TACLA12345C', licName: '', licBio: '', hours: houseClean(BRAND.hours || 'Open 7 days, 7 am to 8 pm'), hoursEs: 'Lunes a sábado de 7 am a 8 pm, domingo con cita', hoursSchema: BRAND.hoursSchema || 'Mo-Sa 07:00-20:00', brands: (BRAND.dealer || []).length ? houseClean(BRAND.dealer.join(' and ') + ' equipment') : 'the major brands', plan: BRAND.plan || 'Our maintenance plan', pay: '$26 to $42 an hour',
        entity: 'HVACBusiness', sameAs: Object.values(BRAND.social || {}).filter(v => /^https?:/.test(String(v))).join(', '), primary: (BRAND.colors || {}).primary || '#13243a', accent: (BRAND.colors || {}).accent || '#c65223', dark: (BRAND.colors || {}).dark || '#0e1a26', globals: true, font_heading: (BRAND.fonts || {}).display || '', font_body: (BRAND.fonts || {}).body || '', logo_url: BRAND.logoUrl || '',
        form_provider: 'html', form_shortcode: '', cta_label: 'Book service', cta_url: '#contact', template: 'default', trust: 'TDLR Lic {lic} | Written prices before work starts | {hours}',
        about: '', video_url: '', testimonials: '', sticky: true, noindex_landing: true, guides_as_posts: false, span: 20, live: '' },
      focus: { scope: 'radius', miles: 30, counties: [], picks: [], metric: 'rep', n: 8, minPop: 10000 },
      build: { home: true, about: true, service: true, careers: false, counties: false, cities: true, landing: true, es: true, guides: true,
        angles: CUSTOMER.slice(), landingAngles: ['replace', 'furnace'], topics: TOPICS.filter(t => t !== 'buildyear') },
      media: { assets: [], assign: {} }, edits: {}, removed: {},
    };
  }

  /* ---------- places ---------- */
  function cityExtra(c) {
    if (c._x) return c._x;
    const zs = (c.zips || []).map(z => ZI[z]).filter(z => z && z.occ > 0); const w = zs.map(z => z.occ);
    const wm = k => { let s = 0, t = 0; zs.forEach((z, i) => { if (isN(z[k])) { s += z[k] * w[i]; t += w[i]; } }); return t ? s / t : null; };
    let hs = 0, ht = 0; zs.forEach(z => { if (isN(z.sys_hp) && isN(z.sys)) { hs += z.sys_hp; ht += z.sys; } });
    const yb = c.yb || []; const tot = sum(yb);
    c._x = { hp_sh: ht ? 100 * hs / ht : null, rent_sf_sh: wm('rent_sf_sh'), span_sh: wm('span_sh'), idx: wm('idx'), effb: wm('effb'), duct_sh: tot ? 100 * ((yb[3] || 0) + (yb[4] || 0)) / tot : null,
      s2010: tot ? 100 * ((yb[0] || 0) + (yb[1] || 0)) / tot : null, s2000: tot ? 100 * (yb[2] || 0) / tot : null, s1990: tot ? 100 * (yb[3] || 0) / tot : null, s1980: tot ? 100 * (yb[4] || 0) / tot : null, spre: tot ? 100 * sum(yb.slice(5)) / tot : null };
    return c._x;
  }
  function office(cfg) { const S = cfg.site; const c = CITY[S.city]; let lat = S.lat, lon = S.lon; if ((!isN(lat) || !isN(lon)) && c) { lat = c.lat; lon = c.lon; } if ((!isN(lat) || !isN(lon)) && S.zip && ZI[S.zip]) { lat = ZI[S.zip].lat; lon = ZI[S.zip].lon; } return { c, lat, lon, fips: c ? c.fips : (S.zip && ZI[S.zip] ? ZI[S.zip].fips : '48113') }; }
  function distMi(c, cfg) { const o = office(cfg); return isN(o.lat) && isN(c.lat) ? hav(o.lat, o.lon, c.lat, c.lon) : 999; }
  const METRICS = {
    rep: ['System replacements a year (model)', c => c.rep], rep_own: ['Owner home replacements a year', c => c.rep_ownsf], opp: ['Replacement dollars a year', c => c.opp_usd],
    ge15: ['Systems 15 years or older', c => c.ge15], r22: ['R22 era systems', c => c.r22], wave: ['Builder originals aged 10 to 25', c => c.orig_win],
    furn20: ['Gas furnaces 20 or older', c => c.furn20], idx: ['Thermal Debt Index, ZIP mean', c => cityExtra(c).idx], eff: ['Paid efficiency, ZIP mean', c => cityExtra(c).effb],
  };
  function markets(cfg) {
    const f = cfg.focus;
    if (f.scope === 'pick') return f.picks.map(n => CITY[n]).filter(Boolean);
    let list = CITIES.filter(c => (c.pop || 0) >= f.minPop);
    if (f.scope === 'radius') list = list.filter(c => distMi(c, cfg) <= f.miles);
    if (f.scope === 'county') list = list.filter(c => f.counties.includes(c.fips));
    const m = (METRICS[f.metric] || METRICS.rep)[1];
    const ranked = list.slice().sort((a, b) => (m(b) || 0) - (m(a) || 0)).slice(0, f.n);
    const home = CITY[cfg.site.city]; if (home && !ranked.includes(home) && list.includes(home)) ranked.push(home);
    return ranked;
  }

  /* ---------- template values ---------- */
  function baseVars(cfg, plan) {
    const S = cfg.site; const o = office(cfg);
    const V = { brand: S.brand || 'Your Company', lic: S.lic || '', phone: phoneFmt(S.phone), hours: S.hours || '', hoursEs: S.hoursEs || S.hours || '', plan: S.plan || 'Our maintenance plan', pay: S.pay || '', brands: S.brands || 'the major brands', officeCity: S.city || 'Dallas', state: 'Texas',
      ac_med: D(WA.AC_TX.median, 0), furn_med: D(WA.GasFurn_TX.median, 0), hp_med: D(WA.HP_TX.median, 0), mrl12: D(mrl(12), 0), mrl15: D(mrl(15), 0),
      m_sys: N(META.sys), m_ge15: N(META.ge15), m_r22: N(META.r22), m_r22_sh: P(100 * META.r22 / META.sys, 0), m_rep: N(META.rep),
      t_n: N(T.n), t_med: M$(T.median), t_p25: M$(T.p25), t_p75: M$(T.p75),
      d100: YTD.d100, d100n: D(YTD.norm_d100, 0), through: fmtMD(YTD.through), throughFull: fmtDate(YTD.through), cddpct: P(100 * (YTD.cdd / YTD.norm_cdd - 1), 0), rank100: RANK100,
      recd100: REC[ci('d100')], recyr: REC[0], tmax26: D(CUR[ci('tmax')], 0), fwheat: FWH != null ? P(FWH, 0) : null };
    V.officeLine = S.street ? `Our office is at ${S.street}, ${S.city}, TX ${S.zip}.` : `We are based in ${S.city}.`;
    V.areaList = listAnd((plan || []).slice(0, 6).map(c => c.name));
    V.hoursShort = (S.hours || '').split(',')[0]; V.hoursRest = (S.hours || '').split(',').slice(1).join(',').trim();
    return V;
  }
  function countyVars(k, V, plan) {
    if (!k) return V;
    V.county = k.name; V.k_sys = N(k.sys); V.k_ge15_sh = P(100 * k.ge15 / k.sys, 0); V.k_r22 = N(k.r22); V.k_hail = N(k.hail1_2016); V.k_hail175 = N(k.hail175_2016);
    V.k_lic = N(k.lic_con); V.k_tech = N(k.lic_tech); V.k_gas = P(k.gas_sh, 0); V.k_furn20 = N(k.furn20); V.k_bps = N(k.bps_u1_2015_25);
    const hb = HAILBIG[k.name]; if (hb) { V.k_bigsize = D(hb[3], 2).replace(/0$/, '').replace(/\.0$/, ''); V.k_bigwhere = `near ${tcase(hb[1])}, ${fmtDate(hb[0])}`; V.k_bigSentence = `The largest was ${V.k_bigsize} inches, near ${tcase(hb[1])} on ${fmtDate(hb[0])}.`; }
    const inC = (plan || []).filter(c => c.fips === k.fips).map(c => c.name); const top = CITIES.filter(c => c.fips === k.fips).sort((a, b) => b.pop - a.pop).map(c => c.name);
    V.countyCities = listAnd((inC.length ? inC : top).slice(0, 6));
    return V;
  }
  function cityVars(c, V, cfg, plan) {
    const x = cityExtra(c);
    V.city = c.name; V.cityFull = c.name + ', TX'; V.cityPop = N(c.pop); V.c_sys = N(c.sys); V.c_ge15 = N(c.ge15); V.c_ge15_sh = P(100 * c.ge15 / c.sys, 0); V.c_r22 = N(c.r22); V.c_r22_sh = P(100 * c.r22 / c.sys, 0);
    V.c_origwin = N(c.orig_win); V.c_origwin_sh = P(100 * c.orig_win / c.sys, 0); V.c_medyr = isN(c.medyr) ? String(Math.round(c.medyr)) : null; V.c_furn20 = N(c.furn20); V.c_gas = P(c.gas_sh, 0);
    V.c_hp = pct0(x.hp_sh); V.c_rent = pct0(x.rent_sf_sh); V.c_duct = pct0(x.duct_sh); V.c_rep = N(c.rep);
    V.ybSentence = x.s2010 != null ? `In ${c.name}, ${pct0(x.s2010)} of homes were built since 2010, ${pct0(x.s2000)} in the 2000s, ${pct0(x.s1990)} in the 1990s, ${pct0(x.s1980)} in the 1980s and ${pct0(x.spre)} before 1980.` : '';
    const near = (plan || []).filter(p => p.name !== c.name).map(p => [p, hav(c.lat, c.lon, p.lat, p.lon)]).sort((a, b) => a[1] - b[1]).slice(0, 4).map(p => p[0].name);
    const near2 = near.length >= 2 ? near : CITIES.filter(p => p.name !== c.name && p.pop >= 10000).map(p => [p, hav(c.lat, c.lon, p.lat, p.lon)]).sort((a, b) => a[1] - b[1]).slice(0, 4).map(p => p[0].name);
    V.nearby = listAnd(near2) + ', and homes across Dallas Fort Worth';
    return V;
  }
  function varsFor(p, cfg, plan) {
    const V = baseVars(cfg, plan); const o = office(cfg);
    if (p.city && CITY[p.city]) { countyVars(COI[CITY[p.city].fips], V, plan); cityVars(CITY[p.city], V, cfg, plan); }
    else if (p.fips) { countyVars(COI[p.fips], V, plan); if (o.c) cityVars(o.c, V, cfg, plan); V.city = V.county + ' County'; }
    else { countyVars(COI[o.fips], V, plan); if (o.c) cityVars(o.c, V, cfg, plan); else { V.city = cfg.site.city; V.cityFull = cfg.site.city + ', TX'; } }
    return V;
  }

  /* ---------- facts (public attribution on the page; grade kept in the forge) ---------- */
  function factItem(k, V) {
    const SRC = { acs: 'U.S. Census Bureau, American Community Survey 2020 to 2024', est: 'Estimate from Census housing data and EIA RECS 2020 equipment ages', recs: 'Lifetime fit to the EIA Residential Energy Consumption Survey 2020, Texas homes', noaa: `NOAA daily records, DFW Airport, through ${V.throughFull}`, noaaU: 'NOAA daily records, DFW Airport', storm: 'NOAA Storm Events Database, 2016 to 2026', tdlr: 'Texas Department of Licensing and Regulation license file, September 2026', irv: 'City of Irving mechanical permits, 2022 to 2025', epa: 'U.S. Environmental Protection Agency', fw: 'City of Fort Worth mechanical permits and NOAA weather, 2012 to 2026' };
    const R = {
      c_sys: [V.c_sys, `central systems estimated in ${V.city} homes`, 'est', 'C'], c_ge15: [V.c_ge15_sh, `of ${V.city} central systems are 15 years or older, about ${V.c_ge15}`, 'est', 'C'],
      c_r22: [V.c_r22, `systems in ${V.city} installed before 2010, the R22 era`, 'est', 'C'], c_medyr: [V.c_medyr, `median year ${V.city} homes were built`, 'acs', 'A'],
      c_origwin: [V.c_origwin_sh, `of ${V.city} systems are the builder original, now 10 to 25 years old`, 'est', 'C'], c_furn20: [V.c_furn20, `gas furnaces in ${V.city} estimated at 20 years or older`, 'est', 'C'],
      c_gas: [V.c_gas, `of ${V.city} homes heat with natural gas`, 'acs', 'A'], c_hp: [V.c_hp, `of ${V.city} central systems estimated to be heat pumps`, 'est', 'C'],
      c_rent: [V.c_rent, `of single family homes in ${V.city} are rented`, 'acs', 'B'], c_duct: [V.c_duct, `of ${V.city} homes were built between 1980 and 1999`, 'acs', 'A'],
      c_rep: [V.c_rep, `system replacements a year expected in ${V.city} at typical Texas lifetimes`, 'est', 'C'],
      k_hail: [V.k_hail, `hail reports of one inch or larger in ${V.county} County since 2016`, 'storm', 'A'], k_hail175: [V.k_hail175, `reports of hail 1.75 inches or larger in ${V.county} County since 2016`, 'storm', 'A'],
      k_big: [V.k_bigsize ? V.k_bigsize + ' in' : null, `largest hailstone reported in ${V.county} County since 2016, ${V.k_bigwhere || ''}`, 'storm', 'A'],
      k_sys: [V.k_sys, `central systems estimated in ${V.county} County homes`, 'est', 'C'], k_ge15: [V.k_ge15_sh, `of ${V.county} County central systems are 15 years or older`, 'est', 'C'],
      k_lic: [V.k_lic, `active TDLR air conditioning contractor licenses in ${V.county} County`, 'tdlr', 'A'], k_tech: [V.k_tech, `active TDLR air conditioning technician licenses in ${V.county} County`, 'tdlr', 'A'],
      k_gas: [V.k_gas, `of ${V.county} County homes heat with natural gas`, 'acs', 'A'], k_furn20: [V.k_furn20, `gas furnaces in ${V.county} County estimated at 20 years or older`, 'est', 'C'],
      ac_life: [`${V.ac_med} years`, 'median age at replacement for a Texas central air conditioner', 'recs', 'B'], furn_life: [`${V.furn_med} years`, 'median age at replacement for a Texas gas furnace', 'recs', 'B'],
      hp_life: [`${V.hp_med} years`, 'median age at replacement for a Texas heat pump', 'recs', 'B'], mrl15: [`${V.mrl15} years`, 'average life left for a Texas air conditioner that has reached 15', 'recs', 'B'],
      m_ge15: [V.m_ge15, 'central systems in Dallas Fort Worth homes estimated at 15 years or older', 'est', 'C'], m_r22: [V.m_r22, 'Dallas Fort Worth systems installed before 2010, the R22 era', 'est', 'C'],
      m_rep: [V.m_rep, 'central system replacements a year expected across the 12 county area', 'est', 'C'],
      ticket: [V.t_med, `median declared value on ${V.t_n} full system replacement permits in Irving, 2022 to 2025`, 'irv', 'B'],
      d100: [`${V.d100} days`, `at 100 degrees or hotter at DFW Airport in 2026 through ${V.through}, against about ${V.d100n} in a normal year`, 'noaa', 'A'],
      cdd: [V.cddpct, 'more cooling demand than normal at DFW Airport in 2026, measured in cooling degree days', 'noaa', 'A'],
      fwheat: [V.fwheat, 'more HVAC permits in Fort Worth for each extra 100 cooling degree days in a month', 'fw', 'B'],
      r22stop: ['2020', 'the year R22 production and import ended in the United States', 'epa', 'A'], a2l: ['2025', 'new split systems made since January 1 use A2L refrigerants such as R454B or R32', 'epa', 'A'],
      uri: ['2 below', 'degrees at DFW Airport on February 16, 2021, during Winter Storm Uri', 'noaaU', 'A'],
    };
    const r = R[k]; if (!r || r[0] == null || r[0] === '—' || r[0] === '' || /undefined|null|NaN/.test(String(r[0]) + r[1])) return null;
    return { key: k, value: String(r[0]), label: r[1], source: SRC[r[2]], grade: r[3] };
  }

  /* ---------- plan ---------- */
  function plan(cfg) {
    const pages = []; const B = cfg.build; const ms = markets(cfg);
    const add = (kind, o) => { const p = Object.assign({ kind, lang: 'en' }, o); p.id = [kind, p.angle || '', p.city || '', p.fips || '', p.topic || '', p.lang].join('|'); pages.push(p); return p; };
    if (B.home) add('home', {});
    if (B.about) add('about', {});
    if (B.service) B.angles.filter(a => C.AC[a] && a !== 'recruit').forEach(a => add('service', { angle: a }));
    if (B.careers) add('service', { angle: 'recruit' });
    const fipsIn = [...new Set(ms.map(c => c.fips))];
    if (B.counties) fipsIn.forEach(f => add('county', { fips: f }));
    if (B.cities) ms.forEach(c => add('city', { city: c.name, fips: c.fips }));
    if (B.landing) ms.forEach(c => B.landingAngles.filter(a => C.AC[a] && a !== 'recruit').forEach(a => { add('landing', { angle: a, city: c.name, fips: c.fips }); if (B.es && (cityExtra(c).span_sh || 0) >= (cfg.site.span || 20) && ANG[a].es) add('landing', { angle: a, city: c.name, fips: c.fips, lang: 'es' }); }));
    if (B.guides) { const G = C.GUIDES.filter(g => B.topics.includes(g.id));
      G.filter(g => g.scope === 'metro').forEach(g => add('guide', { topic: g.id }));
      G.filter(g => g.scope === 'city').forEach(g => ms.forEach(c => add('guide', { topic: g.id, city: c.name, fips: c.fips })));
      G.filter(g => g.scope === 'county').forEach(g => fipsIn.forEach(f => { if (!g.need || g.need(COI[f] || {})) add('guide', { topic: g.id, fips: f }); })); }
    const seen = {}; pages.forEach(p => { Object.assign(p, describe(p, cfg, ms)); if (cfg.edits[p.id]) Object.assign(p, cfg.edits[p.id]); let s = p.slug, n = 2; while (seen[s]) s = p.slug + '-' + (n++); seen[s] = 1; p.slug = s; });
    return { pages: pages.filter(p => !cfg.removed[p.id]), removed: pages.filter(p => cfg.removed[p.id]), markets: ms };
  }
  function fitMeta(s) { s = houseClean(s); if (s.length <= 158) return s; const cut = s.slice(0, 158); const i = cut.lastIndexOf('. '); return i >= 100 ? cut.slice(0, i + 1) : cut.replace(/\s\S*$/, '') + '…'; }
  function fitTitle(t, brand) { t = houseClean(t); if (t.length > 60) t = t.replace(' | ' + brand, ''); if (t.length > 60) t = t.replace(/\s[|:].*$/, ''); if (t.length > 60) t = t.slice(0, 60).replace(/\s\S*$/, ''); return t; }
  function describe(p, cfg, ms) {
    const S = cfg.site; const V = varsFor(p, cfg, ms); const brand = V.brand; const d = {};
    switch (p.kind) {
      case 'home': d.label = 'Home'; d.slug = 'home'; d.h1 = `Heating and Air Conditioning in ${V.officeCity} and Across Dallas Fort Worth`; if (d.h1.length > 70) d.h1 = `Heating and Air Conditioning in ${V.officeCity}, TX`; d.title = `${brand} | AC and Heating in ${V.officeCity}, TX`; d.meta = `AC repair and replacement, furnaces, heat pumps and ductwork across Dallas Fort Worth from ${brand} in ${V.officeCity}. TDLR Lic ${V.lic}. Written prices first.`; break;
      case 'about': d.label = 'About'; d.slug = 'about'; d.h1 = `About ${brand}`; d.title = `About ${brand} | TDLR Licensed HVAC`; d.meta = `${brand} is a heating and air conditioning contractor based in ${V.officeCity}, Texas, TDLR Lic ${V.lic}. Who we are, how we work and the areas we serve.`; break;
      case 'service': { const A = C.AC[p.angle]; d.label = ANG[p.angle].label; d.slug = A.slug; d.h1 = fill(A.h1n, V); d.title = `${A.h1n.replace(/ Across Dallas Fort Worth$/, '')} in DFW | ${brand}`; d.meta = fill(A.lede, V); break; }
      case 'county': d.label = `${V.county} County`; d.slug = slug(V.county) + '-county-hvac'; d.h1 = `Heating and Air Conditioning in ${V.county} County`; d.title = `${V.county} County AC Repair and Replacement | ${brand}`; d.meta = `AC repair and replacement, furnace and heat pump service across ${V.county} County from ${brand}. About ${V.k_ge15_sh} of the county's systems are 15 or older. TDLR Lic ${V.lic}.`; break;
      case 'city': d.label = V.cityFull; d.slug = slug(V.city) + '-hvac'; d.h1 = `AC Repair, Replacement and Heating in ${V.city}, TX`; d.title = `${V.city} AC Repair and Replacement | ${brand}`; d.meta = `AC repair and replacement, furnaces and heat pumps for ${V.city} homes. About ${V.c_ge15_sh} of ${V.city} systems are 15 or older. Written prices, TDLR Lic ${V.lic}.`; break;
      case 'landing': { const a = ANG[p.angle], A = C.AC[p.angle], es = p.lang === 'es'; d.label = (es ? 'Spanish landing · ' : 'Landing · ') + a.short + ' · ' + V.city; d.slug = (es ? 'lp-es-' : 'lp-') + slug(a.short) + '-' + slug(V.city); d.h1 = es ? fill(a.es.h[0], V) : fill(A.h1, V); d.title = es ? `${fill(a.es.h[0], V)} | ${brand}` : `${a.short} in ${V.city}, TX | ${brand}`; d.meta = es ? fill(a.es.d[0], V) : fill(a.meta.p, V); break; }
      case 'guide': { const g = C.GUIDES.find(x => x.id === p.topic); d.label = 'Guide · ' + fill(g.h1, V); d.slug = slug(fill(g.h1, V).replace(/['’]/g, '')); d.h1 = fill(g.h1, V); d.title = fill(g.title, V); d.meta = fill(g.meta, V); break; }
    }
    d.h1 = houseClean(d.h1); d.meta = fitMeta(d.meta); d.title = fitTitle(d.title, brand); d.label = houseClean(d.label);
    return d;
  }

  /* ---------- live URLs (the only internal link targets) ---------- */
  function anchorFrom(path) {
    if (path === '/') return 'Home';
    const seg = path.replace(/\/+$/, '').split('/').pop() || '';
    const t = decodeURIComponent(seg).replace(/\.[a-z]{2,4}$/i, '').replace(/[-_]+/g, ' ').trim();
    const w = t.split(/\s+/).map(x => ({ ac: 'AC', hvac: 'HVAC', r22: 'R22', tx: 'TX', dfw: 'DFW', vip: 'VIP', seer: 'SEER', seer2: 'SEER2', diy: 'DIY' }[x.toLowerCase()] || x.toLowerCase()));
    const s = w.join(' '); return houseClean(s.charAt(0).toUpperCase() + s.slice(1));
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
      out.push({ path, url: path, anchor: it.anchor ? houseClean(it.anchor) : anchorFrom(path) }); });
    if (other) notes.push(`${other} URLs on another host ignored`); if (xml) notes.push(`${xml} child sitemaps listed: paste the page and post sitemaps they point to`);
    return { items: out, notes, index: xml > 0 && !out.length };
  }
  function liveHas(live, path) { return live.items.some(l => l.path === path); }
  function scoreLink(l, tokens, cityTok) { const p = l.path.toLowerCase(); let s = 0; tokens.forEach(t => { if (p.includes(t)) s += 2; }); if (cityTok && p.includes(cityTok)) s += 3; return s; }
  function bestFor(live, angle, cityTok, exclude) { const tok = TOK[angle] || []; let best = null, bs = 0; live.items.forEach(l => { if (exclude && exclude.has(l.path)) return; if (l.path === '/') return; const s = scoreLink(l, tok, null) + (cityTok && l.path.toLowerCase().includes(cityTok) ? 1 : 0); if (s > bs) { bs = s; best = l; } }); return bs >= 2 ? best : null; }
  function linksFor(p, live, self) {
    if (!live.items.length) return [];
    const out = []; const used = new Set([self]); const push = l => { if (l && !used.has(l.path) && out.length < 6) { used.add(l.path); out.push({ anchor: l.anchor, url: l.path }); } };
    const cityTok = p.city ? slug(p.city) : null;
    if (p.kind !== 'home' && p.kind !== 'landing') push(live.items.find(l => l.path === '/'));
    if (p.kind === 'landing') return out;
    const angles = p.kind === 'service' ? [p.angle].concat((C.AC[p.angle] || {}).related || []) : p.kind === 'guide' ? ({ aclife: ['replace', 'maint'], repairreplace: ['repair', 'replace'], heat: ['repair', 'maint'], r22guide: ['r22', 'replace'], buildyear: ['replace', 'duct'], hail: ['hail', 'replace'], furnace: ['furnace', 'heatpump'] }[p.topic] || ['replace']) : ['repair', 'replace', 'furnace', 'maint'];
    if (cityTok) live.items.filter(l => l.path.toLowerCase().includes(cityTok)).slice(0, 2).forEach(push);
    angles.forEach(a => push(bestFor(live, a, cityTok, used)));
    return out;
  }

  /* ---------- blueprint ---------- */
  function entity(cfg, ms) {
    const S = cfg.site; const e = { '@type': S.entity || 'HVACBusiness', name: S.brand };
    const d = String(S.phone || '').replace(/\D/g, ''); if (d.length === 10) e.telephone = '+1' + d; else if (d) e.telephone = S.phone;
    if (S.email) e.email = S.email;
    if (S.street || S.city) e.address = { '@type': 'PostalAddress', streetAddress: S.street || undefined, addressLocality: S.city || undefined, addressRegion: 'TX', postalCode: S.zip || undefined, addressCountry: 'US' };
    const o = office(cfg); if (isN(o.lat)) e.geo = { '@type': 'GeoCoordinates', latitude: +(+o.lat).toFixed(5), longitude: +(+o.lon).toFixed(5) };
    if (S.hoursSchema) e.openingHours = S.hoursSchema;
    if (S.sameAs) e.sameAs = S.sameAs.split(/[\s,]+/).filter(Boolean);
    if (S.lic) e.hasCredential = { '@type': 'EducationalOccupationalCredential', credentialCategory: 'license', name: 'Air Conditioning and Refrigeration Contractor License ' + S.lic, recognizedBy: { '@type': 'GovernmentOrganization', name: 'Texas Department of Licensing and Regulation', url: 'https://www.tdlr.texas.gov/' } };
    if (ms && ms.length) e.areaServed = ms.map(c => ({ '@type': 'City', name: c.name + ', TX' }));
    return e;
  }
  function testimonials(cfg) { const t = (cfg.site.testimonials || '').trim(); if (!t) return null; const items = []; t.split(/\n+/).forEach(line => { const m = line.split('|').map(x => x.trim()); if (m[0]) items.push({ quote: m[0], name: m[1] || '', role: m[2] || '', rating: m[3] ? Number(m[3]) : undefined }); }); return items.length ? items : null; }
  function mediaSpec(p, cfg, V) {
    const S = cfg.site; const m = {}; const asg = cfg.media.assign || {}; const assets = cfg.media.assets || []; const pick = key => { const id = asg[key]; return id ? assets.find(x => x.id === id) : null; };
    const a = pick('page:' + p.id) || pick('city:' + (p.city || '')) || pick('county:' + (p.fips || '')) || pick('kind:' + p.kind) || pick('default');
    const alt = houseClean(p.kind === 'city' || p.kind === 'landing' ? `${S.brand} heating and air conditioning service in ${V.city}, Texas` : p.kind === 'service' ? `${ANG[p.angle].label}, ${S.brand}` : p.kind === 'county' ? `${S.brand} service across ${V.county} County, Texas` : `${S.brand}, heating and air conditioning in ${V.officeCity}, Texas`);
    const q = p.kind === 'city' || p.kind === 'landing' ? V.city + ' hvac' : p.kind === 'service' ? ANG[p.angle].short : p.kind === 'county' ? V.county + ' county' : 'hvac technician';
    if (p.kind !== 'guide') m.hero = { source: a ? 'assets/' + a.file : 'library:' + q, alt, kind: 'image', priority: true };
    const au = pick('author'); if (S.licName) m.author = { source: au ? 'assets/' + au.file : 'library:' + S.licName, alt: houseClean(`${S.licName}, ${S.brand}`), kind: 'image' };
    if (S.video_url && (p.kind === 'home' || p.kind === 'service')) m.explainer = { source: S.video_url, alt: houseClean(`${S.brand}, what a service visit looks like`), kind: 'video' };
    return m;
  }
  function serviceItems(cfg, V, live, pages) {
    const ids = (cfg.build.service ? cfg.build.angles : CUSTOMER).filter(a => a !== 'recruit' && C.AC[a]);
    return ids.slice(0, 9).map(a => { const svc = pages.find(q => q.kind === 'service' && q.angle === a); const own = svc && liveHas(live, '/' + svc.slug + '/') ? { path: '/' + svc.slug + '/' } : bestFor(live, a, null, null);
      return { title: ANG[a].label.charAt(0).toUpperCase() + ANG[a].label.slice(1), text: firstSentence(fill(C.AC[a].lede, V)), url: own ? own.path : undefined, link: own ? 'Read more' : undefined }; });
  }
  function blueprint(p, cfg, pages, live, ms) {
    const S = cfg.site; const missing = []; const V = varsFor(p, cfg, ms); const es = p.lang === 'es';
    const A = p.angle ? C.AC[p.angle] : null, a = p.angle ? ANG[p.angle] : null; const recruit = !!(A && A.recruit); const brand = V.brand;
    const F = t => fill(t, V, missing), FD = x => fillDeep(x, V, missing);
    const used = []; const facts = keys => keys.map(k => factItem(k, V)).filter(Boolean).map(f => { used.push(f); return { value: f.value, label: f.label, source: f.source }; });
    const media = mediaSpec(p, cfg, V); const tst = testimonials(cfg); const today = new Date().toISOString().slice(0, 10);
    const internal = linksFor(p, live, '/' + p.slug + '/');
    const crumbs = liveHas(live, '/') && p.kind !== 'home' && p.kind !== 'landing' ? [{ name: es ? C.ES.breadcrumbs : 'Home', url: '/' }] : [];
    const trust = (es ? C.ES.trust : String(S.trust || '').split('|')).map(x => F(x.trim())).filter(Boolean).slice(0, 3);
    const form = { provider: S.form_provider || 'html', button: recruit ? 'Send my application' : es ? C.ES.form.button : 'Request service', consent: es ? C.ES.form.consent : C.CONSENT };
    if (S.form_shortcode) form.shortcode = S.form_shortcode; if (S.email) form.email_to = S.email; if (es) form.fields = C.ES.form.fields;
    if (recruit) form.fields = [{ id: 'name', label: 'Full name', type: 'text', required: true }, { id: 'phone', label: 'Phone', type: 'tel', required: true }, { id: 'email', label: 'Email', type: 'email', required: true }, { id: 'message', label: 'License or registration and years of experience', type: 'textarea', required: false }];
    const cta = { primary: { label: recruit ? 'Apply now' : es ? C.ES.cta.label : (S.cta_label || 'Book service'), url: S.cta_url || '#contact' }, secondary: { label: es ? 'Cómo trabajamos' : 'How it works', url: '#how-it-works' } };
    if (V.phone) { cta.primary.phone = V.phone; cta.primary.phone_label = es ? fill(C.ES.cta.phone_label, V) : 'Call ' + V.phone; }
    const page = { archetype: { home: 'home', about: 'about', service: 'service', county: 'location', city: 'location', landing: 'landing', guide: 'article' }[p.kind], post_type: p.kind === 'guide' && S.guides_as_posts ? 'post' : 'page',
      slug: p.slug, title: p.title, h1: p.h1, meta_description: p.meta, language: es ? 'es-US' : 'en-US', template: p.kind === 'landing' ? (S.template === 'default' ? 'elementor_canvas' : S.template) : (S.template || 'default'),
      breadcrumbs: crumbs, summary: '', entity: entity(cfg, ms), dates: { published: today, modified: today }, cta, conversion: { sticky_mobile_bar: S.sticky !== false, trust, form }, internal_links: internal, schema_extra: [] };
    if (S.licName) page.author = { name: S.licName, credentials: 'TDLR licensed air conditioning contractor', bio: S.licBio || '', media: media.author ? 'author' : undefined };
    if (p.kind === 'landing' && S.noindex_landing) page.noindex = true;
    if (['service', 'city', 'county'].includes(p.kind) && !recruit) page.service = { '@type': 'Service', serviceType: p.kind === 'service' ? a.label : 'HVAC repair and replacement', areaServed: p.kind === 'city' ? { '@type': 'City', name: V.cityFull } : p.kind === 'county' ? { '@type': 'AdministrativeArea', name: V.county + ' County, TX' } : 'Dallas Fort Worth, TX' };
    const sec = [];
    const hero = o => sec.push(Object.assign({ type: 'hero', media: media.hero ? 'hero' : undefined, layout: media.hero ? 'split' : 'center', cta: ['primary'], trust: true }, o));
    const links = () => { if (internal.length) sec.push({ type: 'links', heading: es ? 'Más información' : 'Related', items: internal }); };
    const notice = () => { const parts = [`${brand}. TDLR Air Conditioning and Refrigeration Contractor License ${V.lic}${S.licName ? ', ' + S.licName : ''}.`, es ? C.ES.notice : C.NOTICE]; if (S.street) parts.push(`${S.street}, ${S.city}, TX ${S.zip}.`); sec.push({ type: 'rich_text', id: 'notice', heading: '', html: `<p><small>${FORGE_COMPILE.esc(parts.join(' '))}</small></p>`, width: 'narrow' }); };
    const formSec = (h, t) => sec.push({ type: 'form', id: 'contact', heading: h, text: t });
    const testi = h => { if (tst && !es && !recruit) sec.push({ type: 'testimonials', heading: h || 'What customers say', items: tst.slice(0, 3) }); };
    const authors = () => { if (page.author && !es) sec.push({ type: 'authors', heading: 'Who stands behind the work' }); };
    const video = h => { if (media.explainer) sec.push({ type: 'video', media: 'explainer', heading: h || `What a visit from ${brand} looks like`, description: page.meta_description }); };
    const band = (h, t) => sec.push({ type: 'cta_band', heading: h, text: t });
    const FORM_H = recruit ? 'Apply in two minutes' : 'Request service', FORM_T = recruit ? 'Your contact details, license or registration and experience. We call within two business days.' : 'Two minutes. We confirm the visit by phone or text.';
    switch (p.kind) {
      case 'home': {
        page.summary = F('{brand}: heating and air conditioning based in {officeCity}, Texas, TDLR Lic {lic}.');
        hero({ eyebrow: F('Heating and air conditioning · {officeCity}, TX'), lede: 'AC repair and replacement, furnaces, heat pumps and ductwork for homes across Dallas Fort Worth. TDLR licensed, with every price in writing before work starts.' });
        sec.push({ type: 'answer', heading: F('Who {brand} is'), body: S.about ? F(S.about) : F('{brand} is a heating and air conditioning contractor based in {officeCity}, Texas, licensed by the Texas Department of Licensing and Regulation under license {lic}. We repair and replace air conditioners, furnaces and heat pumps, replace ductwork and run a maintenance plan for homeowners and rental owners across Dallas Fort Worth. Every repair and every new system is priced in writing before work starts.') });
        sec.push({ type: 'stats', heading: 'Dallas Fort Worth HVAC by the numbers', items: facts(['m_ge15', 'm_r22', 'd100', 'ac_life']).map(f => ({ value: f.value, label: f.label })) });
        sec.push({ type: 'features', id: 'services', heading: 'Services', text: 'Every visit starts with a diagnosis and ends with a written price.', items: serviceItems(cfg, V, live, pages) });
        sec.push({ type: 'steps', id: 'how-it-works', heading: 'How a service visit works', steps: FD(C.STEPS.repair) }); video(); testi();
        sec.push({ type: 'faq', heading: 'Questions people ask before they book', items: FD(C.HOME_FAQ) }); authors();
        band('Book heating or cooling service.', 'Repairs priced before work starts. Replacements quoted in writing.'); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'about': {
        page.summary = F('About {brand}, TDLR Lic {lic}.');
        hero({ eyebrow: brand, lede: F('A heating and air conditioning contractor based in {officeCity}, Texas, serving homes across Dallas Fort Worth. TDLR Lic {lic}.') });
        sec.push({ type: 'answer', heading: F('Who is {brand}?'), body: S.about ? F(S.about) : F('{brand} repairs and replaces air conditioners, furnaces and heat pumps for homes across Dallas Fort Worth from its base in {officeCity}. The company holds TDLR Air Conditioning and Refrigeration Contractor License {lic}.') });
        sec.push({ type: 'key_facts', heading: 'At a glance', items: [{ value: V.lic, label: 'TDLR Air Conditioning and Refrigeration Contractor License', source: 'Texas Department of Licensing and Regulation' }, { value: V.officeCity, label: 'where the company is based', source: brand }, { value: 'Written', label: 'prices before any repair or replacement', source: brand }].concat(V.hoursShort ? [{ value: V.hoursShort, label: V.hoursRest || 'hours', source: brand }] : []) });
        sec.push({ type: 'rich_text', heading: 'How we work', html: '<p>Every job starts with a diagnosis or a home visit, and every price is given in writing before work starts. Replacements are sized by a room by room load calculation and installed by our own crew, and we pull the city permit wherever one is required. You get the model and serial numbers and the permit number for your records.</p>' });
        sec.push({ type: 'rich_text', heading: 'License and consumer information', html: `<p>${FORGE_COMPILE.esc(brand)} holds Texas Department of Licensing and Regulation Air Conditioning and Refrigeration Contractor License ${FORGE_COMPILE.esc(V.lic)}. You can verify it with the license search on the <a href="https://www.tdlr.texas.gov/">TDLR website</a>. ${C.NOTICE}</p>` });
        sec.push({ type: 'faq', heading: 'Questions customers ask', items: FD(C.HOME_FAQ).slice(0, 4) }); authors();
        band('Book heating or cooling service.', 'Repairs priced before work starts. Replacements quoted in writing.'); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'service': {
        page.summary = F(`${a.label} from {brand}: `) + firstSentence(strip(F(A.answer)));
        hero({ eyebrow: F(A.eyebrow), lede: F(A.lede) });
        sec.push({ type: 'answer', heading: AQ[p.angle], body: F(A.answer) });
        sec.push({ type: 'key_facts', heading: recruit ? 'The numbers' : 'The numbers behind the decision', items: facts(A.facts) });
        sec.push({ type: 'rich_text', heading: recruit ? 'The roles' : 'What the options are', html: F(A.what) });
        sec.push({ type: 'rich_text', heading: recruit ? 'Requirements' : 'Before the visit', html: F(A.who) });
        sec.push({ type: 'steps', id: 'how-it-works', heading: recruit ? 'How hiring works' : 'How it works', steps: FD(C.STEPS[A.steps]) }); video(); testi();
        sec.push({ type: 'faq', heading: `${a.short} questions people ask`, items: FD(A.faq) }); authors();
        band(F(BAND[p.angle] + '.'), recruit ? 'We call qualified applicants within two business days.' : 'Prices in writing before work starts.');
        formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'county': {
        const k = COI[p.fips]; page.summary = F('{brand} across {county} County: {k_ge15_sh} of central systems are 15 or older.');
        hero({ eyebrow: F('{brand} · {county} County'), lede: F('{brand} repairs and replaces air conditioners, furnaces and heat pumps across {county} County, from our base in {officeCity}. TDLR Lic {lic}.') });
        sec.push({ type: 'answer', heading: F('How old are the HVAC systems in {county} County?'), body: F('An estimated {k_ge15_sh} of the {k_sys} central systems in {county} County homes are 15 years or older, and about {k_r22} were installed before 2010, the R22 era. The county has logged {k_hail} hail reports of one inch or larger since 2016, and {k_gas} of its homes heat with gas.') });
        sec.push({ type: 'key_facts', heading: F('{county} County by the numbers'), items: facts(['k_sys', 'k_ge15', 'k_hail', 'k_lic']) });
        const cs = (ms.filter(c => c.fips === p.fips).length ? ms.filter(c => c.fips === p.fips) : CITIES.filter(c => c.fips === p.fips).sort((x, y) => y.pop - x.pop).slice(0, 8));
        sec.push({ type: 'table', heading: F('Cities in {county} County'), columns: ['City', 'Median year built', 'Systems 15 or older', 'R22 era systems', 'Gas heat'], rows: cs.map(c => [c.name, isN(c.medyr) ? String(Math.round(c.medyr)) : '', P(100 * c.ge15 / c.sys, 0), N(c.r22), P(c.gas_sh, 0)]) });
        sec.push({ type: 'rich_text', heading: 'What the county numbers mean', html: F(`<p>{county} County permitted {k_bps} new single family homes from 2015 to 2025, and those systems reach their first replacement in the 2030s. The older stock is the work in front of us now: about {k_r22} systems date from the R22 era, and an estimated {k_furn20} gas furnaces are 20 or older.</p><p>{k_hail} hail reports of one inch or larger since 2016 mean condenser coils here take real damage. After a storm, an inspection with photos is worth having before you decide on a claim.</p>`) });
        sec.push({ type: 'steps', id: 'how-it-works', heading: 'How a replacement quote works', steps: FD(C.STEPS.replace) }); testi();
        sec.push({ type: 'faq', heading: F('Questions {county} County homeowners ask'), items: FD(C.COUNTY_FAQ) }); authors();
        band(F('Book heating or cooling service in {county} County.'), 'Repairs priced before work starts. Replacements quoted in writing.'); formSec(FORM_H, FORM_T); notice(); links(); void k; break; }
      case 'city': {
        const c = CITY[p.city]; const x = cityExtra(c); const gasHeavy = (c.gas_sh || 0) >= 35;
        page.summary = F('{brand} in {city}: AC repair and replacement, furnaces and heat pumps; {c_ge15_sh} of {city} systems are 15 or older.');
        hero({ eyebrow: F('{brand} · {city}'), lede: F('Repairs priced before work starts, replacements quoted in writing and installed by our own crew, and furnace and heat pump service for {city} homes. TDLR Lic {lic}.') });
        sec.push({ type: 'answer', heading: F('Who services heating and air conditioning in {city}?'), body: F('{brand} repairs and replaces air conditioners, furnaces and heat pumps in {city} and across {county} County, ' + (p.city === S.city ? 'from our office here in {city}' : 'from our base in {officeCity}') + '. Every repair is priced before work starts and every new system is quoted in writing. In {city}, an estimated {c_ge15_sh} of central systems are 15 years or older, so whenever a major repair comes up on an older system we price the replacement next to it.') });
        sec.push({ type: 'key_facts', heading: F('{city} by the numbers'), items: facts(['c_ge15', 'c_r22', 'c_medyr', gasHeavy ? 'c_gas' : 'c_hp']) });
        const heatS = gasHeavy ? F('{c_gas} of homes heat with gas, and about {c_furn20} furnaces are 20 or older.') : (x.hp_sh >= 30 ? F('About {c_hp} of central systems are heat pumps, which heat as well as cool.') : F('{c_gas} of homes heat with gas; most of the rest heat with electricity.'));
        const hailS = F('{county} County has logged {k_hail} hail reports of one inch or larger since 2016.');
        const impl = (100 * c.orig_win / c.sys) >= 15 ? F('Much of {city} is in its first replacement wave: builder systems from the 2000s and 2010s are reaching the age when most Texas systems are replaced.') : (100 * c.r22 / c.sys) >= 16 ? F('Many {city} homes still run R22 era systems, and a leak on one of those is the moment to compare repair and replacement side by side.') : F('Most {city} systems are in mid life, when maintenance does the most good and a written replacement budget avoids surprises.');
        sec.push({ type: 'rich_text', heading: F('The {city} picture'), html: F(`<p>The median home in {city} was built in {c_medyr}. {ybSentence} An estimated {c_sys} central systems serve the city's homes; about {c_ge15} are 15 or older and {c_r22} were installed before 2010, the R22 era. ${heatS} ${hailS}</p><p>${impl}</p>`) });
        sec.push({ type: 'features', id: 'services', heading: F('Services in {city}'), items: serviceItems(cfg, V, live, pages) });
        sec.push({ type: 'steps', id: 'how-it-works', heading: 'How a replacement quote works', steps: FD(C.STEPS.replace) }); testi(F('What {city} customers say'));
        sec.push({ type: 'faq', heading: F('Questions {city} homeowners ask'), items: FD(C.CITY_FAQ) }); authors();
        band(F('Book heating or cooling service in {city}.'), 'Repairs priced before work starts. Replacements quoted in writing.'); formSec(FORM_H, FORM_T); notice(); links(); break; }
      case 'landing': {
        page.breadcrumbs = []; page.summary = es ? F(`Página de campaña: ${a.short}, {cityFull}.`) : F(`Campaign landing page: ${a.short}, {cityFull}.`);
        if (es) {
          hero({ eyebrow: F(a.es.h[1] || a.es.h[0]), lede: F(a.es.d[0]), layout: media.hero ? 'cover' : 'center', trust: true });
          sec.push({ type: 'answer', heading: C.ES.aq, body: C.ES.answer[{ furnace: 'heat', heatpump: 'heat', hail: 'hail', duct: 'duct' }[p.angle] || 'cool'] });
          sec.push({ type: 'key_facts', heading: '', items: [{ value: V.c_ge15_sh, label: F(C.ES.facts.ge15), source: 'Estimación con datos del Censo y EIA RECS 2020' }, { value: 'Por escrito', label: C.ES.facts.written, source: brand }, { value: V.lic, label: C.ES.facts.lic, source: 'Texas Department of Licensing and Regulation' }] });
          sec.push({ type: 'features', heading: 'Por qué llamarnos', items: FD(C.ES.features) });
          sec.push({ type: 'faq', heading: 'Antes de llamar', items: FD(C.ES.faq) });
          formSec(C.ES.formHead, F(a.es.d[1] || a.es.d[0])); band(F(C.ES.band.heading), C.ES.band.text);
        } else {
          hero({ eyebrow: F(A.eyebrow), lede: F(a.meta.p), layout: media.hero ? 'cover' : 'center', trust: true });
          sec.push({ type: 'answer', heading: AQ[p.angle], body: F(A.answer) });
          const f0 = factItem('c_ge15', V); if (f0) used.push(f0);
          sec.push({ type: 'key_facts', heading: '', items: [f0 ? { value: f0.value, label: F('of {city} central systems are 15 years or older'), source: f0.source } : null, { value: 'Written', label: 'price and options before any work starts', source: brand }, { value: V.lic, label: 'TDLR contractor license', source: 'Texas Department of Licensing and Regulation' }].filter(Boolean) });
          sec.push({ type: 'features', heading: 'Why homeowners call us', items: [{ title: 'Prices in writing', text: 'Every option is priced before work starts.' }, { title: 'Our own crew', text: 'Installed by our own licensed crew, with the city permit pulled.' }, { title: V.hoursShort || 'Local', text: V.hoursShort ? (V.hoursRest ? V.hoursRest.charAt(0).toUpperCase() + V.hoursRest.slice(1) + '.' : V.hours + '.') : F('Based in {officeCity}.') }] });
          sec.push({ type: 'faq', heading: 'Before you book', items: FD(A.faq).slice(0, 3) });
          formSec('Request a visit', 'Two minutes. We confirm by phone or text.'); band(F(BAND[p.angle] + (p.angle === 'maint' ? '' : ' in {city}') + '.'), 'Prices in writing before work starts.');
        }
        notice(); break; }
      case 'guide': {
        const g = C.GUIDES.find(x => x.id === p.topic);
        page.summary = firstSentence(strip(F(g.answer)));
        hero({ eyebrow: 'Guide · ' + (g.scope === 'county' ? V.county + ' County' : g.scope === 'city' ? V.city : 'Dallas Fort Worth'), lede: F(g.meta), layout: 'center', media: undefined, trust: false, cta: ['primary'] });
        sec.push({ type: 'answer', heading: 'The short answer', body: F(g.answer) });
        sec.push({ type: 'key_facts', heading: 'The facts behind it', items: facts(g.facts) });
        if (g.table === 'mrl') sec.push({ type: 'table', heading: 'How Texas air conditioners age', columns: ['System age', 'Share already replaced', 'Average years of life left'], rows: [5, 8, 10, 12, 15, 18, 20].map(t => [t + ' years', P(100 * (1 - weibS(t, LAM, KW)), 0), D(mrl(t), 1)]) });
        const heads = g.id === 'repairreplace' ? ['What the numbers say', 'How to weigh it', 'What to do'] : ['What the numbers say', 'Why it happens', 'What to do'];
        g.body.forEach((b, i) => sec.push({ type: 'rich_text', heading: heads[i], html: F(b) }));
        sec.push({ type: 'faq', heading: 'Questions readers ask', items: FD(g.faq) }); authors();
        band(F('Book a visit with {brand}.'), 'Repairs priced before work starts. Replacements quoted in writing.'); notice(); links(); break; }
    }
    const bp = { forge: '1', site: { url: S.url || 'https://www.example.com', name: brand, cms: S.cms || undefined, brand: { name: brand, primary: S.primary, accent: S.accent, dark: S.dark, font_heading: S.font_heading || undefined, font_body: S.font_body || undefined, logo_url: S.logo_url || undefined, globals: S.globals !== false } }, page, media, sections: cleanDeep(sec) };
    bp.page.summary = houseClean(bp.page.summary); bp.page.conversion.trust = trust.map(houseClean);
    bp.page.internal_links = internal.map(l => ({ anchor: houseClean(l.anchor), url: l.url }));
    if (!media.author && bp.page.author) delete bp.page.author.media;
    bp._facts = used; bp._missing = missing.filter((x, i, arr) => arr.indexOf(x) === i);
    return bp;
  }

  /* ---------- checks ---------- */
  function pageText(bp) {
    const out = []; const pg = bp.page;
    out.push(['seo.title', pg.title || ''], ['seo.h1', pg.h1 || ''], ['seo.meta', pg.meta_description || '']);
    (pg.conversion.trust || []).forEach((t, i) => out.push(['hero.trust' + i, t]));
    for (const s of bp.sections) { const tag = s.id === 'notice' ? 'notice' : s.type;
      ['eyebrow', 'lede', 'body', 'text', 'html', 'heading', 'caption'].forEach(k => { if (s[k]) out.push([tag + '.' + k, strip(s[k])]); });
      (s.items || []).forEach((it, i) => { ['q', 'a', 'text', 'label', 'title', 'value', 'quote', 'anchor'].forEach(k => { if (it[k]) out.push([tag + '.' + k + i, String(it[k])]); }); });
      (s.steps || []).forEach((st, i) => { out.push([tag + '.s' + i, st.title + '. ' + st.text]); });
      (s.rows || []).forEach((r, i) => out.push([tag + '.r' + i, r.join(' ')])); }
    return out;
  }
  function checks(bp, r, cfg) {
    const I = []; const add = (id, sev, where, ev, msg, cite, fix) => { if (!I.some(x => x.id === id && x.where === where)) I.push({ id, sev, where, ev, msg, cite, fix }); };
    const txt = pageText(bp);
    txt.filter(([w]) => !w.startsWith('notice')).forEach(([where, t]) => satchelLint(t, { web: true }).forEach(l => add(l.rule.id, l.rule.sev, where, l.ev, l.rule.name, l.rule.cite, l.rule.fix)));
    const all = txt.map(x => x[1]).join('\n');
    satchelLint(all, { page: true, needLic: true, lic: cfg.site.lic }).filter(l => l.rule.id === 'TDLR1' || l.rule.id === 'TDLR2').forEach(l => add(l.rule.id, l.rule.sev, 'page', l.ev, l.rule.name, l.rule.cite, l.rule.fix));
    const src = r.html + '\n' + JSON.stringify(r.schema);
    SAT.web.filter(w => w.id !== 'WEB1').forEach(w => { const ev = w.test(src); if (ev) add(w.id, w.sev, 'page source', ev, w.name, w.cite, w.fix); });
    (r.lint || []).forEach((s, li) => { const block = /^BLOCK/.test(s); const media = /^MEDIA/.test(s); const links = /no internal links/.test(s);
      add('FORGE', block ? 'block' : (media || links) ? 'note' : 'warn', 'compiler ' + (li + 1), '', links ? 'No internal links yet: paste the live sitemap in step 4 and links are drawn from it' : media ? s.replace(/ — .*$/, '').replace(/^MEDIA: /, 'Media ') + ', resolved at deploy' : s, '', ''); });
    if ((bp.page.h1 || '').length > 70) add('LEN', 'warn', 'seo.h1', bp.page.h1.length + ' chars', 'H1 over 70 characters', '', 'Shorten in the studio.');
    if ((bp.page.title || '').length > 60) add('LEN', 'warn', 'seo.title', bp.page.title.length + ' chars', 'Title over 60 characters', '', 'Shorten in the studio.');
    if (bp._missing.length) add('VARS', 'warn', 'template', bp._missing.join(', '), 'Template values without data on this page were dropped; read the page for gaps', '', 'Fill the site field or pick a place with the data.');
    const n = s => I.filter(x => x.sev === s).length;
    return { issues: I.sort((x, y) => ['block', 'warn', 'note'].indexOf(x.sev) - ['block', 'warn', 'note'].indexOf(y.sev)), block: n('block'), warn: n('warn'), note: n('note') };
  }
  const wordCount = bp => pageText(bp).filter(([w]) => !w.startsWith('seo.')).reduce((t, [, s]) => t + words(s), 0);
  return { KL, CITY, METRICS, CUSTOMER, TOPICS, defaultCfg, markets, plan, blueprint, checks, pageText, wordCount, parseLive, cityExtra, distMi, office, factItem, baseVars, varsFor, fill, anchorFrom, mrl, RANK100 };
})();

registerModule({
  key: 'forge', num: '09', title: 'Site Forge', desc: 'Service, city, county and guide pages written from the model, linted and compiled for WordPress',
  mount(root) {
    const E = FORGE, FC = FORGE_COMPILE;
    const merge = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]); else if (b[k] !== undefined) a[k] = b[k]; } return a; };
    let CFG = merge(E.defaultCfg(), store.get('tda.forge.v1', {}) || {});
    let LIVE = E.parseLive(CFG.site.live, CFG.site.url);
    let PLAN = { pages: [], removed: [], markets: [] }, BUILT = new Map(), SEL = null, ASSETS = [], DEPLOYED = new Map(), WPSTAT = null, TAB = 'preview', PUBLISH_OK = false;
    const save = debounce(() => { CFG.media.assets = ASSETS.map(a => ({ id: a.id, file: a.file, kind: a.kind, w: a.w, h: a.h })); store.set('tda.forge.v1', CFG); }, 400);
    const SITE_F = [
      ['brand', 'Business name', 'text'], ['url', 'Public site URL', 'url', 'Canonicals, schema and the live sitemap host use this.'], ['cms', 'WordPress URL, if different (headless)', 'url'], ['phone', 'Phone', 'tel'], ['email', 'Lead email (form notifications)', 'email'],
      ['street', 'Office street', 'text', 'Written without hyphens or dashes; it prints in every page footer.'], ['city', 'Office city', 'text'], ['zip', 'ZIP', 'text'],
      ['lic', 'TDLR contractor license number', 'text', 'Required in all advertising, 16 TAC §75.71(h). Printed in the trust strip and footer of every page.'], ['licName', 'Licensee name (optional)', 'text', 'Shown as who stands behind the work, and as reviewedBy in the schema.'], ['licBio', 'Licensee bio, two sentences (optional)', 'text'],
      ['hours', 'Hours, as customers read them', 'text', 'Only if actually staffed; the Satchel notes availability claims.'], ['hoursEs', 'Hours in Spanish', 'text'], ['hoursSchema', 'Hours for schema (openingHours)', 'text'],
      ['brands', 'Equipment installed', 'text'], ['plan', 'Maintenance plan name', 'text'], ['pay', 'Recruiting pay range', 'text'],
      ['sameAs', 'Profiles for sameAs (Google, Facebook, BBB), comma separated', 'text'], ['logo_url', 'Logo URL', 'url'], ['font_heading', 'Heading font', 'text'], ['font_body', 'Body font', 'text'],
      ['cta_label', 'Primary button label', 'text'], ['cta_url', 'Primary button URL', 'text'], ['form_shortcode', 'Form shortcode (plugin forms)', 'text'], ['video_url', 'Explainer video URL (YouTube or Vimeo)', 'url'], ['span', 'Spanish landing pages where Spanish at home is at least (%)', 'number'],
    ];
    const kindOpts = Object.entries(E.KL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    root.innerHTML = mastHTML({ eyebrow: 'Module 09 · Site Forge', title: 'Site Forge', dek: 'The atlas\'s cities and numbers turned into the website that receives the campaigns: a service page per angle, a page per market city, optional county hubs, campaign landing pages in English and Spanish, and data guides written from the replacement model, the permit records and the DFW climate record. Every page is linted by the Emergency Satchel against TDLR\'s advertising rule and the FTC and Texas deceptive practices rules, carries no hyphens or dashes, compiles in the browser to Elementor, semantic HTML and JSON-LD, and deploys to WordPress as drafts through the FORGE bridge.',
      meta: [`<b>${N(CITIES.length)}</b> cities with system age, refrigerant and heating facts`, `<b>${N(CO.length)}</b> counties with hail and license facts`, `<b>${FCOPY.GUIDES.length}</b> data guide topics · <b>${E.CUSTOMER.length}</b> service angles`, '<b>Internal links</b> only to live URLs'],
      bar: 'Site Forge', barsub: 'Plan, build, deploy', actions: [['f9Pack', '↓ Pack'], ['f9ElZ', '↓ Elementor'], ['f9BpZ', '↓ Blueprints'], ['f9Bridge', '↓ Bridge plugin'], ['f9LedX', '↓ Ledger'], ['f9Save', '⤓ Save'], ['f9Load', '⤒ Load']].map(([id, label]) => ({ id, label })) }) +
      `<div class="wrap">
      ${callout('', 'Read this first: what the forge does and does not do', `Modules one to eight say where the aging systems are, which cities pay back, what the rules are and what the ads say. This module writes the pages those ads land on. Describe the contractor once, choose the markets (the atlas ranks the cities), tick the page types and the forge plans the set, writes each page from the model's own numbers with a public source beside every figure, and checks it. It never publishes on its own, never invents a review, never links to a page that is not live on the site's sitemap, and never uses Ahrefs. Copy is written without hyphens or dashes and every text field is cleaned again before it compiles. Deploying from the hosted atlas is blocked by the viewer's network rules, so deploy from the downloaded standalone file or hand the pack to the FORGE skill.`)}
      <input type="file" id="f9LoadF" accept=".json,application/json" hidden>
      <div class="card mt"><div class="card-h"><h3>1 · The site</h3><p>Everything here flows into every page: schema, calls to action, the form, the trust strip and the license footer. The fields open with the benchmark contractor from the heatmap; saved in this browser as you type.</p></div><div class="card-b">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn sec sm" id="f9Desk">⇠ Import from the Campaign Desk</button><button class="btn sec sm" id="f9Reset">Reset to the benchmark contractor</button></div>
        <div class="plan">${SITE_F.map(([k, l, t, h]) => `<div class="f"><label class="fl" for="f9s_${k}">${l}</label><input type="${t}" id="f9s_${k}" data-k="${k}">${h ? `<span class="hint">${h}</span>` : ''}</div>`).join('')}
          <div class="f"><label class="fl" for="f9s_entity">Schema entity type</label><select id="f9s_entity" data-k="entity"><option value="HVACBusiness">HVACBusiness</option><option value="HomeAndConstructionBusiness">HomeAndConstructionBusiness</option><option value="LocalBusiness">LocalBusiness</option></select></div>
          <div class="f"><label class="fl" for="f9s_form_provider">Lead form</label><select id="f9s_form_provider" data-k="form_provider"><option value="html">HTML form posting to the bridge</option><option value="elementor_pro">Elementor Pro form</option><option value="shortcode">Plugin shortcode</option></select></div>
          <div class="f"><label class="fl" for="f9s_template">Page template</label><select id="f9s_template" data-k="template"><option value="default">Theme default</option><option value="elementor_header_footer">Elementor full width</option><option value="elementor_canvas">Elementor canvas</option></select><span class="hint">Landing pages use canvas when the theme default is chosen.</span></div>
          <div class="f"><label class="fl">Brand colors: primary · accent · dark</label><div style="display:flex;gap:6px"><input type="color" id="f9s_primary" data-k="primary"><input type="color" id="f9s_accent" data-k="accent"><input type="color" id="f9s_dark" data-k="dark"></div></div>
          <div class="f wide"><label class="fl" for="f9s_trust">Trust strip (three items separated by |)</label><input type="text" id="f9s_trust" data-k="trust"><span class="hint">{lic} and {hours} fill from the fields above.</span></div>
          <div class="f wide"><label class="fl" for="f9s_about">Who the company is, two or three sentences (optional)</label><textarea id="f9s_about" data-k="about" placeholder="Leave empty and the forge writes it from the license, city and services."></textarea></div>
          <div class="f wide"><label class="fl" for="f9s_testimonials">Real customer reviews with permission on file (one per line: quote | name | context | rating). Leave empty to omit</label><textarea id="f9s_testimonials" data-k="testimonials"></textarea><span class="hint">The forge never writes a review. Quote only what the customer wrote, and keep counts and ratings off the page unless they match the live profile on a stated date.</span></div>
          <div class="f wide"><div class="chips"><label class="chk"><input type="checkbox" id="f9s_sticky" data-k="sticky"> Sticky mobile call bar</label><label class="chk"><input type="checkbox" id="f9s_noindex_landing" data-k="noindex_landing"> noindex campaign landing pages</label><label class="chk"><input type="checkbox" id="f9s_guides_as_posts" data-k="guides_as_posts"> Publish guides as posts</label><label class="chk"><input type="checkbox" id="f9s_globals" data-k="globals"> Use Elementor global colors and fonts</label></div></div>
        </div></div></div>

      <div class="card mt"><div class="card-h"><h3>2 · Where to focus</h3><p>Cities come from the atlas's block level model: systems, ages, refrigerant era, heating fuel and modeled replacements. Rank them by what the business sells, and limit them to the drive the crews will make.</p></div><div class="card-b">
        <div class="plan">
          <div class="f"><label class="fl" for="f9Scope">Scope</label><select id="f9Scope"><option value="radius">Within a drive of the office</option><option value="county">Selected counties</option><option value="all">All of DFW</option><option value="pick">Hand picked cities</option></select></div>
          <div class="f"><label class="fl" for="f9Miles">Miles from the office</label><input type="number" id="f9Miles" min="5" max="120" step="5"></div>
          <div class="f"><label class="fl" for="f9Counties">Counties (county scope)</label><select id="f9Counties" multiple size="4">${CO.map(c => `<option value="${c.fips}">${c.name}</option>`).join('')}</select></div>
          <div class="f"><label class="fl" for="f9Metric">Rank by</label><select id="f9Metric">${Object.entries(E.METRICS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>
          <div class="f"><label class="fl" for="f9N">Cities · minimum population</label><div style="display:flex;gap:6px"><input type="number" id="f9N" min="1" max="120" style="width:80px"><select id="f9Min"><option value="0">any</option><option value="5000">5,000+</option><option value="10000">10,000+</option><option value="25000">25,000+</option><option value="50000">50,000+</option></select></div></div>
          <div class="f wide"><label class="fl" for="f9Picks">Hand picked cities (comma separated; other modules send their ZIPs here as cities)</label><input type="text" id="f9Picks" placeholder="Mesquite, Garland, Rowlett"></div>
        </div>
        <div class="split"><div class="mapcard" style="border:1px solid var(--line);border-radius:10px;overflow:hidden"><div id="f9Map"></div><div class="legend" id="f9Leg"></div></div><div><div class="tscroll short" id="f9Mk"></div><p class="mini" style="margin-top:8px">Click a city to drop it from the plan; click a ZIP on the map to add its city. Figures are the atlas's estimates (grade C) except build year and gas heat (ACS, grade A).</p></div></div>
      </div></div>

      <div class="card mt"><div class="card-h"><h3>3 · What to build</h3><p>Tick the page types. Guides appear only where the numbers they describe exist: hail guides for counties with at least 100 large hail reports since 2016, furnace guides where gas heat and old furnaces are common.</p></div><div class="card-b">
        <div class="chips" id="f9Types">${[['home', 'Home page'], ['about', 'About and license page'], ['service', 'Service page per angle'], ['careers', 'Careers page'], ['counties', 'County hub per county in the plan'], ['cities', 'City page per market city'], ['landing', 'Campaign landing page per angle and city'], ['es', 'Spanish landing variants'], ['guides', 'Data guides']].map(([k, l]) => `<label class="chk"><input type="checkbox" data-b="${k}"> ${l}</label>`).join('')}</div>
        <div class="dsec" style="margin-top:14px">Service pages</div><div class="chips" id="f9Angles"></div>
        <div class="dsec" style="margin-top:14px">Landing page angles</div><div class="chips" id="f9Land"></div>
        <div class="dsec" style="margin-top:14px">Guide topics</div><div class="chips" id="f9Topics"></div>
        <div class="mt">${callout('judg', 'Doorway risk: fewer, better city pages', 'Templated city pages are the fastest route into a doorway or scaled content problem. Every city page here carries that city\'s own numbers, but a dozen pages from one template still read as a pattern. If the site already has a page per suburb, consolidate or rewrite those before adding new ones, and publish a city page only where its numbers say something the others do not. The defaults are deliberately conservative: eight cities by replacement volume plus the office city, landing pages noindexed, and the per city build year guide off.')}</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px"><button class="btn" id="f9Build">⚒ Build all pages</button><span class="mini" id="f9BuildNote"></span></div>
      </div></div>
      <div class="kpis" id="f9Kpis"></div>

      <div class="card mt"><div class="card-h"><h3>4 · Live pages on the site</h3><p>The only pages the forge will ever link to. Paste the site's XML sitemap (the page and post sitemaps, not the index) or a list of live URLs, one per line, optionally as "anchor | URL". Pages in this plan become link targets once they are published and appear here.</p></div><div class="card-b">
        <textarea id="f9Live" class="code" style="min-height:120px" placeholder="&lt;urlset&gt;&lt;url&gt;&lt;loc&gt;https://www.example.com/ac-repair/&lt;/loc&gt;&lt;/url&gt;...&lt;/urlset&gt;"></textarea>
        <div class="mini" id="f9LiveSum" style="margin-top:6px"></div></div></div>

      <div class="card mt"><div class="card-h"><h3>5 · The page ledger</h3><p>Every planned page with its slug, lengths, words and checks. Click a row to open it in the studio; remove what you do not want.</p></div><div class="card-b">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px"><div class="ctl"><label class="fl" for="f9LType">Type</label><select id="f9LType"><option value="">All types</option>${kindOpts}</select></div><div class="ctl"><label class="fl" for="f9LSearch">Search</label><input type="search" id="f9LSearch" placeholder="city, angle, slug"></div><label class="chk"><input type="checkbox" id="f9LRem"> Show removed pages</label></div>
        <div class="tscroll" id="f9Ledger"></div></div></div>

      <div class="card mt" id="f9Studio"><div class="card-h"><h3>6 · Page studio</h3><p id="f9StHead">Select a page in the ledger.</p></div><div class="card-b">
        <div class="plan"><div class="f"><label class="fl" for="f9StTitle">Title <span class="mini" id="f9StTitleC"></span></label><input type="text" id="f9StTitle"></div><div class="f"><label class="fl" for="f9StH1">H1 <span class="mini" id="f9StH1C"></span></label><input type="text" id="f9StH1"></div><div class="f"><label class="fl" for="f9StSlug">Slug</label><input type="text" id="f9StSlug"></div><div class="f wide"><label class="fl" for="f9StMeta">Meta description <span class="mini" id="f9StMetaC"></span></label><input type="text" id="f9StMeta"></div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px"><button class="btn sm" id="f9StApply">Apply and rebuild</button><button class="btn sec sm" id="f9StReset">Discard edits</button><button class="btn sec sm" id="f9StRemove">Remove from plan</button><span class="spacer" style="flex:1"></span><button class="btn ghost sm" id="f9StBp">↓ Blueprint</button><button class="btn ghost sm" id="f9StEl">↓ Elementor template</button><button class="btn ghost sm" id="f9StHtml">↓ Preview HTML</button><button class="btn ghost sm" id="f9StBundle">↓ Bridge bundle</button></div>
        <div class="split21"><div style="min-width:0"><div class="ptabs" id="f9StTabs"><button data-v="preview" aria-pressed="true">Preview</button><button data-v="mobile" aria-pressed="false">Mobile</button><button data-v="blueprint" aria-pressed="false">Blueprint</button><button data-v="elementor" aria-pressed="false">Elementor JSON</button><button data-v="schema" aria-pressed="false">Schema</button><button data-v="html" aria-pressed="false">HTML</button></div><div id="f9StPane"></div></div>
          <div class="stack" style="min-width:0"><div><div class="dsec">Checks</div><div id="f9Checks"><span class="mini">No page open.</span></div></div><div><div class="dsec">Facts on this page · value, source, grade</div><div id="f9Facts"></div></div><div><div class="dsec">Internal links · live URLs only</div><div id="f9Links"></div></div></div></div>
      </div></div>

      <div class="card mt"><div class="card-h"><h3>7 · Media</h3><p>Drop photos and video of the real crews, trucks and jobs. Images are resized to 1920 pixels and converted to WebP in the browser. Assign each to the pages it belongs to; a page asset beats a city asset, which beats a county asset, a page type asset and the site default. Unassigned slots resolve from the site's media library at deploy, and a page never ships with a placeholder.</p></div><div class="card-b">
        <div class="drop" id="f9Drop" tabindex="0" role="button">Drop files here or click to choose: JPG, PNG, WebP, MP4, WebM</div><input type="file" id="f9File" multiple accept="image/*,video/mp4,video/webm" hidden>
        <div class="xscroll mt"><table id="f9MediaTbl"><thead><tr><th class="l">Preview</th><th class="l">File</th><th>Size</th><th class="l">Assign to</th><th class="l">Alt text</th><th></th></tr></thead><tbody></tbody></table></div></div></div>

      <div class="card mt"><div class="card-h"><h3>8 · Deploy to WordPress</h3><p>Application Password over REST through the FORGE bridge plugin (download it from the bar above, then Plugins, Add New, Upload, Activate). Everything lands as a draft unless you choose to publish. Credentials stay in this tab. <b>Every other platform</b> (headless WordPress with the Next.js kit, Drupal, Wix, Duda, Webflow, Shopify, HubSpot, Joomla, Ghost) publishes from <a href="#publish" data-go="publish">module 16, Publish</a>, which reads the pages built here.</p></div><div class="card-b">
        <div class="plan"><div class="f"><label class="fl" for="f9dUrl">WordPress URL</label><input type="url" id="f9dUrl"></div><div class="f"><label class="fl" for="f9dUser">Username</label><input type="text" id="f9dUser" autocomplete="off"></div><div class="f"><label class="fl" for="f9dPass">Application password</label><input type="password" id="f9dPass" autocomplete="off"><span class="hint">Users, Profile, Application Passwords. An Administrator account is needed for Elementor data.</span></div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px"><button class="btn sec sm" id="f9dTest">Test connection</button><span class="mini" id="f9dNote">Not connected.</span></div>
        <div id="f9dCors" hidden>${callout('judg', 'The browser could not reach the site', `Inside the hosted atlas the viewer blocks every outbound connection, so deploy from the downloaded standalone file (with this page's origin added to the bridge's allowed origins in its settings) or download the pack and let the FORGE skill deploy from the shell. Origin of this page: <code id="f9dOrigin"></code>.`)}</div>
        <div class="chips" style="margin-top:10px"><label class="chk"><input type="checkbox" id="f9dMedia" checked> Upload assets and reuse library matches</label><label class="chk"><input type="checkbox" id="f9dPublish"> Publish instead of draft</label><label class="chk"><input type="checkbox" id="f9dOnlyNew" checked> Skip pages already deployed this session</label></div>
        <div id="f9dConfirm" hidden class="msg err" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span id="f9dConfirmT"></span><button class="btn sm" id="f9dConfirmGo">Publish them</button><button class="btn sec sm" id="f9dConfirmNo">Keep as drafts</button></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" id="f9dGo" disabled>Deploy pages</button><button class="btn sec" id="f9dLive" disabled>Refresh live URLs from the site</button><button class="btn sec" id="f9dLinks" disabled>Verify links against live URLs</button><button class="btn sec" id="f9dIdx" disabled>IndexNow published pages</button></div>
        <div class="status mt" id="f9dStatus">Not connected.</div>
        <div class="xscroll mt"><table id="f9dRes"><thead><tr><th class="l">Page</th><th class="l">Status</th><th class="l">Link</th><th class="l">Edit</th><th>Media</th><th class="l">Note</th></tr></thead><tbody></tbody></table></div></div></div>

      <div class="card mt"><div class="card-h"><h3>9 · Method, sources, grades and the hand-off</h3><p>How a page is written, where every number comes from, and what to check before anything goes live.</p></div><div class="card-b" id="f9Method"></div></div>
      <div class="foot">Site Forge writes pages; it does not publish them. The FORGE bridge plugin is a generic WordPress REST bridge; review it before installing on a production site.</div>
      </div>`;

    /* ---------- site ---------- */
    const S = () => CFG.site;
    function writeSite() { $$('[data-k]', root).forEach(i => { const k = i.dataset.k; const v = S()[k]; if (i.type === 'checkbox') i.checked = k === 'globals' ? v !== false : !!v; else i.value = v == null ? '' : v; }); }
    function readSite() { $$('[data-k]', root).forEach(i => { const k = i.dataset.k; S()[k] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? +i.value : i.value.trim(); });
      if (FORGE.CITY[S().city]) { S().lat = FORGE.CITY[S().city].lat; S().lon = FORGE.CITY[S().city].lon; } }
    $$('[data-k]', root).forEach(i => i.addEventListener('change', () => { readSite(); save(); replan(); }));
    $('#f9Reset', root).onclick = () => { const live = S().live; CFG.site = E.defaultCfg().site; CFG.site.live = live; writeSite(); save(); replan(); toast('Site fields reset to the benchmark contractor'); };
    $('#f9Desk', root).onclick = () => { if (MODI.desk && !MODI.desk.mounted) { MODI.desk.mounted = true; try { MODI.desk.mount($('#mod-desk')); } catch (e) { console.error(e); } } const d = MODI.desk && MODI.desk.plan ? MODI.desk.plan() : store.get('tda.desk.v1', null); if (!d) { toast('Open the Campaign Desk once so its plan exists'); return; }
      const s = S(); ['brand', 'lic', 'url', 'city', 'pay'].forEach(k => { if (d[k]) s[k] = d[k]; }); if (d.phone) s.phone = phoneFmt(d.phone); if (d.spanTh != null) s.span = d.spanTh;
      const zips = d.zips || (d.scope === 'picks' ? d.picks : null); if (zips && zips.length) { const names = citiesFromZips(zips); if (names.length) { CFG.focus.scope = 'pick'; CFG.focus.picks = names; } }
      if (d.angles && d.angles.length && d.line !== 'recruit') { const cust = d.angles.filter(a => E.CUSTOMER.includes(a)); if (cust.length) CFG.build.landingAngles = cust.slice(0, 3); }
      if (d.line === 'recruit') CFG.build.careers = true;
      writeSite(); syncFocus(); syncBuild(); save(); replan(); $('#f9BuildNote', root).textContent = `Imported from the Campaign Desk: ${s.brand}, ${CFG.focus.scope === 'pick' ? CFG.focus.picks.length + ' cities' : 'scope kept'}, ${CFG.build.landingAngles.length} landing angles.`; };
    function citiesFromZips(zips) { const out = []; zips.forEach(z => { const r = ZI[z]; if (!r) return; const nm = r.city; if (FORGE.CITY[nm] && !out.includes(nm)) out.push(nm); else { const c = CITIES.find(c => (c.zips || []).includes(z)); if (c && !out.includes(c.name)) out.push(c.name); } }); return out; }

    /* ---------- focus ---------- */
    const map = new ZipMap($('#f9Map', root), { onSelect: zip => { const nm = citiesFromZips([zip])[0]; if (!nm) return; const F0 = CFG.focus; if (F0.scope !== 'pick') { F0.scope = 'pick'; F0.picks = PLAN.markets.map(c => c.name); } if (F0.picks.includes(nm)) F0.picks = F0.picks.filter(x => x !== nm); else F0.picks.push(nm); syncFocus(); save(); replan(); },
      onHover: (zip, e) => { const z = ZI[zip]; if (!z) return; const c = FORGE.CITY[z.city]; showTip(`<div class="tt">${z.zip} · ${esc(z.city)}</div>${c ? tipRow('City systems', N(c.sys)) + tipRow('15 years or older', P(100 * c.ge15 / c.sys, 0)) + tipRow('R22 era', N(c.r22)) + tipRow('Miles from office', D(E.distMi(c, CFG), 0)) : '<div class="ts">Not a city in the model</div>'}<div class="tf">Click to add or drop this city</div>`, e); } });
    function syncFocus() { const f = CFG.focus; $('#f9Scope', root).value = f.scope; $('#f9Miles', root).value = f.miles; $('#f9Metric', root).value = f.metric; $('#f9N', root).value = f.n; $('#f9Min', root).value = String(f.minPop); $('#f9Picks', root).value = f.picks.join(', '); $$('#f9Counties option', root).forEach(o => o.selected = f.counties.includes(o.value)); }
    function readFocus() { const f = CFG.focus; f.scope = $('#f9Scope', root).value; f.miles = +$('#f9Miles', root).value || 30; f.metric = $('#f9Metric', root).value; f.n = clamp(+$('#f9N', root).value || 12, 1, 120); f.minPop = +$('#f9Min', root).value; f.counties = $$('#f9Counties option', root).filter(o => o.selected).map(o => o.value); f.picks = $('#f9Picks', root).value.split(',').map(s => s.trim()).filter(s => FORGE.CITY[s]); }
    ['#f9Scope', '#f9Miles', '#f9Metric', '#f9N', '#f9Min', '#f9Counties', '#f9Picks'].forEach(s => $(s, root).addEventListener('change', () => { readFocus(); if (CFG.focus.scope === 'pick' && !CFG.focus.picks.length) CFG.focus.picks = PLAN.markets.map(c => c.name); syncFocus(); save(); replan(); }));
    function renderFocus() {
      const ms = PLAN.markets; const inPlan = new Set(ms.map(c => c.name)); const mk = (E.METRICS[CFG.focus.metric] || E.METRICS.rep);
      const zset = new Set(); ms.forEach(c => (c.zips || []).forEach(z => zset.add(z)));
      const vals = ms.map(c => mk[1](c)); const q = qScale(vals, 'ember', 1); const cityOf = {}; ms.forEach(c => (c.zips || []).forEach(z => { if (!cityOf[z]) cityOf[z] = c; }));
      map.fill(zip => cityOf[zip] ? q.f(mk[1](cityOf[zip])) : null); map.dim(zset.size ? zset : null);
      const o = E.office(CFG); map.pins(isN(o.lat) ? [{ id: 'office', lat: o.lat, lon: o.lon, r: 9, fill: cssv('--bench'), shape: 'diamond' }] : []);
      $('#f9Leg', root).innerHTML = legendHTML({ title: mk[0] + ', cities in the plan', R: q.R, lo: K(q.lo), hi: K(q.hi), note: '◆ office' });
      const dh = $('#f9Mk', root); dh._st = dh._st || { k: 'v', dir: -1 };
      dataTable(dh, [{ k: 'name', h: 'City', l: 1 }, { k: 'cty', h: 'County', l: 1 }, { k: 'mi', h: 'Miles', v: c => E.distMi(c, CFG), f: v => D(v, 0) }, { k: 'v', h: mk[0].replace(/ \(model\)$/, ''), v: c => mk[1](c), f: v => /dollar/.test(mk[0]) ? MM(v) : isN(v) && v < 200 ? D(v, 0) : N(v) }, { k: 'sys', h: 'Systems', f: v => N(v) }, { k: 'ge', h: '15 or older', v: c => 100 * c.ge15 / c.sys, f: v => P(v, 0) }, { k: 'r22', h: 'R22 era', f: v => N(v) }, { k: 'medyr', h: 'Median built', f: v => isN(v) ? Math.round(v) : '—' }, { k: 'gas_sh', h: 'Gas heat', f: v => P(v, 0) }, { k: 'span', h: 'Spanish', v: c => E.cityExtra(c).span_sh, f: v => P(v, 0) }], ms,
        { id: c => c.name, onClick: nm => { const F0 = CFG.focus; if (F0.scope !== 'pick') { F0.scope = 'pick'; F0.picks = ms.map(c => c.name); } F0.picks = F0.picks.filter(x => x !== nm); syncFocus(); save(); replan(); } });
      if (!ms.length) dh.innerHTML = '<p class="mini">No city passes these filters. Widen the drive, lower the population floor or switch scope.</p>';
      void inPlan;
    }

    /* ---------- build choices ---------- */
    function chipRow(host, ids, sel, label, onToggle) { host.innerHTML = ids.map(id => `<button class="chip" data-id="${id}" aria-pressed="${sel.includes(id)}">${esc(label(id))}</button>`).join(''); $$('button', host).forEach(b => b.onclick = () => { onToggle(b.dataset.id); }); }
    function syncBuild() { const B = CFG.build; $$('#f9Types [data-b]', root).forEach(i => i.checked = !!B[i.dataset.b]);
      const tog = (arr, id) => arr.includes(id) ? arr.filter(x => x !== id) : arr.concat([id]);
      chipRow($('#f9Angles', root), E.CUSTOMER, B.angles, id => ANG[id].short, id => { B.angles = tog(B.angles, id); syncBuild(); save(); replan(); });
      chipRow($('#f9Land', root), E.CUSTOMER, B.landingAngles, id => ANG[id].short, id => { B.landingAngles = tog(B.landingAngles, id); syncBuild(); save(); replan(); });
      chipRow($('#f9Topics', root), E.TOPICS, B.topics, id => FCOPY.GUIDES.find(g => g.id === id).label + ' (' + FCOPY.GUIDES.find(g => g.id === id).scope + ')', id => { B.topics = tog(B.topics, id); syncBuild(); save(); replan(); }); }
    $$('#f9Types [data-b]', root).forEach(i => i.onchange = () => { CFG.build[i.dataset.b] = i.checked; save(); replan(); });

    /* ---------- live URLs ---------- */
    $('#f9Live', root).addEventListener('change', () => { S().live = $('#f9Live', root).value; LIVE = E.parseLive(S().live, S().url); save(); renderLive(); rebuildBuilt(); });
    function renderLive() { const L = LIVE; const host = $('#f9LiveSum', root);
      if (!L.items.length) { host.innerHTML = L.index ? '<b>This is a sitemap index.</b> Paste the child page and post sitemaps it lists.' : `<b>No live URLs yet.</b> Pages build without internal links until the site's live URLs are here${S().url ? ' (host ' + esc(hostOfUrl(S().url)) + ')' : ''}.`; return; }
      host.innerHTML = `<b>${N(L.items.length)} live URLs</b> on ${esc(hostOfUrl(S().url))}${L.notes.length ? ' · ' + esc(L.notes.join('; ')) : ''}. Examples: ${L.items.slice(0, 5).map(l => `<code>${esc(l.path)}</code>`).join(' ')}`; }
    const hostOfUrl = u => { try { return new URL(u).hostname; } catch (e) { return u; } };

    /* ---------- plan and build ---------- */
    function replan() { PLAN = E.plan(CFG); const ids = new Set(PLAN.pages.map(p => p.id)); for (const k of [...BUILT.keys()]) if (!ids.has(k)) BUILT.delete(k); BUILT.forEach((b, id) => { const p = PLAN.pages.find(x => x.id === id); if (p) buildPage(p); }); renderFocus(); renderKpis(); renderLedger(); if (SEL) { if (ids.has(SEL)) openPage(SEL, true); else closeStudio(); } }
    function previewMedia(bp) { const map = {}; for (const [k, spec] of Object.entries(bp.media || {})) { const src = spec.source || ''; if (src.startsWith('assets/')) { const a = ASSETS.find(x => x.file === src.slice(7)); if (a) map[k] = { id: 0, url: a.url, alt: a.alt || spec.alt, kind: a.kind, width: a.w, height: a.h }; } else if (/^https?:/.test(src) && spec.kind === 'video') map[k] = { id: 0, url: src, alt: spec.alt, kind: 'video' }; } return map; }
    function buildPage(p) { const prev = BUILT.get(p.id); let bp = prev && prev.override ? prev.override : E.blueprint(p, CFG, PLAN.pages, LIVE, PLAN.markets); const r = FC.compile(bp, previewMedia(bp)); const ch = E.checks(bp, r, CFG); const b = { bp, r, ch, words: E.wordCount(bp), override: prev ? prev.override : null }; BUILT.set(p.id, b); return b; }
    function ensureBuilt() { PLAN.pages.forEach(p => { if (!BUILT.has(p.id)) buildPage(p); }); }
    function rebuildBuilt() { PLAN = E.plan(CFG); BUILT.forEach((b, id) => { const p = PLAN.pages.find(x => x.id === id); if (p) buildPage(p); }); renderKpis(); renderLedger(); if (SEL) openPage(SEL, true); }
    $('#f9Build', root).onclick = () => { const t0 = performance.now(); PLAN.pages.forEach(p => buildPage(p)); renderKpis(); renderLedger(); $('#f9BuildNote', root).textContent = `Built and linted ${PLAN.pages.length} pages in ${Math.round(performance.now() - t0)} ms.`; if (!SEL && PLAN.pages.length) openPage(PLAN.pages[0].id); };
    function renderKpis() {
      const P0 = PLAN.pages; const bs = P0.map(p => BUILT.get(p.id)).filter(Boolean); const by = k => P0.filter(p => p.kind === k).length; const ms = PLAN.markets;
      $('#f9Kpis', root).innerHTML = kpiHTML([
        { l: 'Pages planned', v: N(P0.length), d: `${by('service')} service · ${by('city')} city · ${by('landing')} landing · ${by('guide')} guides${by('county') ? ' · ' + by('county') + ' county' : ''}` },
        { l: 'Cities in the plan', v: N(ms.length), d: ms.slice(0, 4).map(c => c.name).join(', ') + (ms.length > 4 ? ' and ' + (ms.length - 4) + ' more' : '') },
        { l: 'Replacements a year', g: 'C', v: N(sum(ms.map(c => c.rep))), d: `${P(100 * sum(ms.map(c => c.rep)) / META.rep, 0)} of the DFW total, in the plan's cities` },
        { l: 'Systems 15 or older', g: 'C', v: N(sum(ms.map(c => c.ge15))), d: `${N(sum(ms.map(c => c.r22)))} of them R22 era` },
        { l: 'Built', v: `${N(bs.length)} of ${N(P0.length)}`, d: bs.length ? `${N(sum(bs.map(b => b.words)))} words` : 'press Build all pages' },
        { l: 'Blocking checks', v: N(sum(bs.map(b => b.ch.block))), d: `${N(sum(bs.map(b => b.ch.warn)))} warnings · ${N(sum(bs.map(b => b.ch.note)))} notes` },
        { l: 'Internal links', v: N(sum(bs.map(b => b.bp.page.internal_links.length))), d: LIVE.items.length ? `from ${N(LIVE.items.length)} live URLs` : 'none until live URLs are pasted' }]); }
    function renderLedger() {
      const t = $('#f9LType', root).value, q = $('#f9LSearch', root).value.trim().toLowerCase(), showRem = $('#f9LRem', root).checked;
      const rows = PLAN.pages.concat(showRem ? PLAN.removed.map(p => Object.assign({ _rem: true }, p)) : []).filter(p => (!t || p.kind === t) && (!q || (p.label + ' ' + p.slug + ' ' + (p.city || '') + ' ' + (p.angle || '')).toLowerCase().includes(q)));
      const host = $('#f9Ledger', root); host._st = host._st || { k: 'n', dir: 1 };
      const idx = new Map(PLAN.pages.map((p, i) => [p.id, i]));
      dataTable(host, [{ k: 'n', h: '#', v: p => idx.has(p.id) ? idx.get(p.id) + 1 : 999, f: v => v === 999 ? '' : v }, { k: 'kind', h: 'Type', l: 1, v: p => E.KL[p.kind] }, { k: 'label', h: 'Page', l: 1, f: (v, p) => esc(v) + (p.lang === 'es' ? ' <span class="pill">ES</span>' : '') + (p._rem ? ' <span class="pill">removed</span>' : '') + (CFG.edits[p.id] ? ' <span class="pill">edited</span>' : '') }, { k: 'slug', h: 'Slug', l: 1, f: v => `<span class="mono" style="font-size:11px">/${esc(v)}/</span>` },
        { k: 'tl', h: 'Title', v: p => p.title.length, f: v => `<span style="color:${v > 60 ? 'var(--critical)' : 'inherit'}">${v}</span>` }, { k: 'ml', h: 'Meta', v: p => p.meta.length, f: v => `<span style="color:${v > 158 || v < 70 ? 'var(--judg)' : 'inherit'}">${v}</span>` },
        { k: 'w', h: 'Words', v: p => (BUILT.get(p.id) || {}).words, f: v => isN(v) ? N(v) : '·' }, { k: 'b', h: 'Blocks', v: p => ((BUILT.get(p.id) || {}).ch || {}).block, f: v => isN(v) ? (v ? `<b style="color:var(--critical)">${v}</b>` : '0') : '·' }, { k: 'wa', h: 'Warn', v: p => ((BUILT.get(p.id) || {}).ch || {}).warn, f: v => isN(v) ? v : '·' },
        { k: 'lk', h: 'Links', v: p => { const b = BUILT.get(p.id); return b ? b.bp.page.internal_links.length : null; }, f: v => isN(v) ? v : '·' }, { k: 'st', h: 'Deploy', l: 1, v: p => (DEPLOYED.get(p.id) || {}).status || '', f: v => v ? `<span class="pill">${esc(v)}</span>` : '' }],
        rows, { id: p => p.id, rowClass: p => p.id === SEL ? 'sel' : '', onClick: id => { const p = PLAN.removed.find(x => x.id === id); if (p) { delete CFG.removed[id]; save(); replan(); toast('Restored ' + p.label); return; } openPage(id); } });
      if (!rows.length) host.innerHTML = '<p class="mini">No pages match.</p>'; }
    ['#f9LType', '#f9LSearch', '#f9LRem'].forEach(s => $(s, root).addEventListener('input', renderLedger));

    /* ---------- studio ---------- */
    function closeStudio() { SEL = null; $('#f9StHead', root).textContent = 'Select a page in the ledger.'; $('#f9StPane', root).innerHTML = ''; $('#f9Checks', root).innerHTML = '<span class="mini">No page open.</span>'; $('#f9Facts', root).innerHTML = ''; $('#f9Links', root).innerHTML = ''; }
    function counters() { const t = $('#f9StTitle', root).value.length, h = $('#f9StH1', root).value.length, m = $('#f9StMeta', root).value.length; $('#f9StTitleC', root).textContent = `${t} of 60`; $('#f9StTitleC', root).style.color = t > 60 ? 'var(--critical)' : ''; $('#f9StH1C', root).textContent = `${h} of 70`; $('#f9StH1C', root).style.color = h > 70 ? 'var(--critical)' : ''; $('#f9StMetaC', root).textContent = `${m}, aim 120 to 158`; $('#f9StMetaC', root).style.color = m < 120 || m > 158 ? 'var(--judg)' : ''; }
    ['#f9StTitle', '#f9StH1', '#f9StMeta'].forEach(s => $(s, root).addEventListener('input', counters));
    function openPage(id, quiet) {
      const p = PLAN.pages.find(x => x.id === id); if (!p) return; SEL = id; const b = BUILT.get(id) || buildPage(p);
      $('#f9StHead', root).innerHTML = `<b>${esc(E.KL[p.kind])}</b> · ${esc(p.label)} · <span class="mono">/${esc(p.slug)}/</span> · ${N(b.words)} words${b.override ? ' · <span class="pill">edited blueprint</span>' : ''}`;
      $('#f9StTitle', root).value = p.title; $('#f9StH1', root).value = p.h1; $('#f9StSlug', root).value = p.slug; $('#f9StMeta', root).value = p.meta; counters();
      renderPane(); const ch = b.ch;
      $('#f9Checks', root).innerHTML = ch.issues.length ? ch.issues.map(i => `<div class="issue ${i.sev}"><b>${esc(i.sev.toUpperCase())} · ${esc(i.id)}</b> ${esc(i.msg)}${i.ev ? ` <span class="mini">${esc(i.ev)}</span>` : ''}<br><span class="mini">${esc(i.where)}${i.cite ? ' · ' + esc(i.cite) : ''}${i.fix ? ' · ' + esc(i.fix) : ''}</span></div>`).join('') : '<div class="msg ok">No findings. The page passes the Satchel rule pack, the house style and the compiler checks.</div>';
      $('#f9Facts', root).innerHTML = (b.bp._facts || []).length ? b.bp._facts.map(f => `<div class="rowl"><span>${esc(f.value)} <span class="mini">${esc(f.label)}</span><br><span class="mini">${esc(f.source)}</span></span><b>${G(f.grade)}</b></div>`).join('') : '<span class="mini">This page states no model figures.</span>';
      const L = b.bp.page.internal_links || []; $('#f9Links', root).innerHTML = L.length ? L.map(l => `<div class="rowl"><span>${esc(l.anchor)}</span><span class="mini mono">${esc(l.url)}</span></div>`).join('') : `<span class="mini">${LIVE.items.length ? 'No live URL matches this page.' : 'None: paste the live sitemap in step 4.'}</span>`;
      renderLedger(); if (!quiet) $('#f9Studio', root).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function renderPane() {
      const host = $('#f9StPane', root); if (!SEL) { host.innerHTML = ''; return; } const b = BUILT.get(SEL); if (!b) return;
      $$('#f9StTabs button', root).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === TAB)));
      if (TAB === 'preview' || TAB === 'mobile') { host.innerHTML = `<div style="${TAB === 'mobile' ? 'max-width:400px;margin:0 auto' : ''}"><iframe class="prev" sandbox="allow-same-origin" title="Page preview" style="${TAB === 'mobile' ? 'height:760px' : ''}"></iframe></div>`; $('iframe', host).srcdoc = b.r.preview.replace(/<script(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, ''); return; }
      if (TAB === 'blueprint') { const bp = Object.assign({}, b.bp); delete bp._facts; delete bp._missing; host.innerHTML = `<textarea class="code" id="f9BpTxt" style="min-height:520px">${esc(JSON.stringify(bp, null, 1))}</textarea><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn sm" id="f9BpUse">Use edited blueprint</button><button class="btn sec sm" id="f9BpDrop">Back to the generated blueprint</button><span class="mini" id="f9BpMsg"></span></div>`;
        $('#f9BpUse', host).onclick = () => { let o; try { o = JSON.parse($('#f9BpTxt', host).value); } catch (e) { $('#f9BpMsg', host).textContent = 'Not valid JSON: ' + e.message; return; } o._facts = b.bp._facts; o._missing = []; b.override = o; const p = PLAN.pages.find(x => x.id === SEL); buildPage(p); openPage(SEL, true); toast('Edited blueprint compiled'); };
        $('#f9BpDrop', host).onclick = () => { b.override = null; const p = PLAN.pages.find(x => x.id === SEL); buildPage(p); openPage(SEL, true); }; return; }
      const txt = TAB === 'elementor' ? JSON.stringify(b.r.template, null, 1) : TAB === 'schema' ? JSON.stringify(b.r.schema, null, 1) : b.r.html;
      host.innerHTML = `<pre style="max-height:640px">${esc(txt)}</pre><div style="margin-top:8px"><button class="btn sec sm" id="f9Copy">Copy</button></div>`; $('#f9Copy', host).onclick = () => copyText(txt);
    }
    wireSeg($('#f9StTabs', root), v => { TAB = v; renderPane(); });
    $('#f9StApply', root).onclick = () => { if (!SEL) return; const ed = { title: houseClean($('#f9StTitle', root).value.trim()), h1: houseClean($('#f9StH1', root).value.trim()), slug: slug($('#f9StSlug', root).value.trim()), meta: houseClean($('#f9StMeta', root).value.trim()) }; Object.keys(ed).forEach(k => { if (!ed[k]) delete ed[k]; }); CFG.edits[SEL] = ed; const b = BUILT.get(SEL); if (b) b.override = null; save(); replan(); openPage(SEL, true); toast('Edits applied; they survive a full rebuild'); };
    $('#f9StReset', root).onclick = () => { if (!SEL) return; delete CFG.edits[SEL]; const b = BUILT.get(SEL); if (b) b.override = null; save(); replan(); openPage(SEL, true); };
    $('#f9StRemove', root).onclick = () => { if (!SEL) return; CFG.removed[SEL] = 1; BUILT.delete(SEL); save(); const l = (PLAN.pages.find(p => p.id === SEL) || {}).label; closeStudio(); replan(); toast('Removed ' + (l || 'page') + '; tick "Show removed pages" to restore it'); };
    const selB = () => SEL ? BUILT.get(SEL) : null;
    const stripBp = bp => { const o = Object.assign({}, bp); delete o._facts; delete o._missing; return o; };
    $('#f9StBp', root).onclick = () => { const b = selB(); if (b) saveFile(b.bp.page.slug + '.blueprint.json', JSON.stringify(stripBp(b.bp), null, 1)); };
    $('#f9StEl', root).onclick = () => { const b = selB(); if (b) saveFile(b.bp.page.slug + '.elementor-template.json', JSON.stringify(b.r.template)); };
    $('#f9StHtml', root).onclick = () => { const b = selB(); if (b) saveFile(b.bp.page.slug + '.preview.html', b.r.preview); };
    $('#f9StBundle', root).onclick = () => { const b = selB(); if (b) saveFile(b.bp.page.slug + '.bundle.json', JSON.stringify(FC.bundle(stripBp(b.bp), {}, FC.compile(stripBp(b.bp), {})))); };

    /* ---------- media ---------- */
    const drop = $('#f9Drop', root), fileIn = $('#f9File', root);
    drop.onclick = () => fileIn.click(); drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } };
    drop.ondragover = e => { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; }; drop.ondragleave = () => drop.style.borderColor = '';
    drop.ondrop = e => { e.preventDefault(); drop.style.borderColor = ''; addFiles([...e.dataTransfer.files]); }; fileIn.onchange = () => { addFiles([...fileIn.files]); fileIn.value = ''; };
    async function addFiles(files) {
      for (const f of files) { try { const stem = f.name.replace(/\.[^.]+$/, ''); const ext = (f.name.match(/\.[^.]+$/) || [''])[0].toLowerCase(); let rec;
        if (f.type.startsWith('image/') && !/svg|gif/.test(f.type)) { let bmp; try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch (e) { bmp = await createImageBitmap(f); } const r = Math.min(1, 1920 / Math.max(bmp.width, bmp.height)); const w = Math.round(bmp.width * r), h = Math.round(bmp.height * r); const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(bmp, 0, 0, w, h); const blob = await new Promise(res => cv.toBlob(res, 'image/webp', 0.82)); const webp = blob && blob.type === 'image/webp'; rec = { kind: 'image', blob: blob || f, w, h, mime: webp ? 'image/webp' : f.type, file: slug(stem) + (webp ? '.webp' : ext) }; }
        else rec = { kind: f.type.startsWith('video/') ? 'video' : 'image', blob: f, mime: f.type, file: slug(stem) + ext };
        rec.id = 'a' + Math.random().toString(36).slice(2, 9); rec.name = f.name; rec.size = rec.blob.size; rec.url = URL.createObjectURL(rec.blob); rec.alt = ''; ASSETS.push(rec); } catch (e) { console.warn('asset', f.name, e); toast('Could not read ' + f.name); } }
      save(); renderMedia(); rebuildBuilt(); }
    function assignOptions(cur) { const cities = PLAN.markets.map(c => c.name); const fips = [...new Set(PLAN.markets.map(c => c.fips))];
      const opts = [['', 'Unassigned'], ['default', 'Site default hero'], ['author', 'Licensee headshot']].concat(Object.keys(E.KL).map(k => ['kind:' + k, 'All ' + E.KL[k].toLowerCase() + ' pages'])).concat(fips.map(f => ['county:' + f, CNAME(f) + ' County pages'])).concat(cities.map(c => ['city:' + c, c + ' pages']));
      if (SEL) opts.push(['page:' + SEL, 'The page open in the studio']);
      return opts.map(o => `<option value="${esc(o[0])}" ${cur === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join(''); }
    function renderMedia() { const asg = CFG.media.assign; const rev = {}; for (const k in asg) rev[asg[k]] = k;
      $('#f9MediaTbl tbody', root).innerHTML = ASSETS.map(a => `<tr><td class="l">${a.kind === 'image' ? `<img src="${a.url}" alt="" style="width:72px;height:48px;object-fit:cover;border-radius:6px">` : '<span class="pill">video</span>'}</td><td class="l">${esc(a.file)}${a.w ? ` <span class="mini">${a.w} × ${a.h}</span>` : ''}</td><td>${N(a.size / 1024)} KB</td><td class="l"><select data-as="${a.id}">${assignOptions(rev[a.id] || '')}</select></td><td class="l"><input type="text" data-alt="${a.id}" value="${esc(a.alt || '')}" placeholder="what the photo shows" style="min-width:200px"></td><td><button class="btn ghost sm" data-del="${a.id}">Remove</button></td></tr>`).join('') || `<tr><td colspan="6" class="l mini">No assets yet. Photos are not saved with the plan; add them again after a reload.</td></tr>`;
      $$('#f9MediaTbl select[data-as]', root).forEach(s => s.onchange = () => { const id = s.dataset.as; for (const k in asg) if (asg[k] === id) delete asg[k]; if (s.value) asg[s.value] = id; save(); rebuildBuilt(); });
      $$('#f9MediaTbl input[data-alt]', root).forEach(i => i.onchange = () => { const a = ASSETS.find(x => x.id === i.dataset.alt); if (a) { a.alt = houseClean(i.value.trim()); i.value = a.alt; } rebuildBuilt(); });
      $$('#f9MediaTbl [data-del]', root).forEach(b => b.onclick = () => { const id = b.dataset.del; const a = ASSETS.find(x => x.id === id); if (a) URL.revokeObjectURL(a.url); ASSETS = ASSETS.filter(x => x.id !== id); for (const k in asg) if (asg[k] === id) delete asg[k]; save(); renderMedia(); rebuildBuilt(); }); }

    /* ---------- deploy ---------- */
    const WP = { base() { return ($('#f9dUrl', root).value || S().cms || S().url || '').trim().replace(/\/+$/, ''); }, auth() { return btoa(unescape(encodeURIComponent($('#f9dUser', root).value.trim() + ':' + $('#f9dPass', root).value.trim()))); },
      async req(method, path, body, raw) { const h = { Authorization: 'Basic ' + this.auth() }; if (body && !raw) h['Content-Type'] = 'application/json'; if (raw) { h['Content-Type'] = raw.mime; h['Content-Disposition'] = `attachment; filename="${raw.name}"`; }
        const r = await fetch(this.base() + '/wp-json/' + path.replace(/^\//, ''), { method, headers: h, body: body ? (raw ? body : JSON.stringify(body)) : undefined, mode: 'cors', credentials: 'omit' });
        let j = null; try { j = await r.json(); } catch (e) { } if (!r.ok) { const er = new Error((j && (j.message || j.code)) || ('HTTP ' + r.status)); er.status = r.status; throw er; } return j; } };
    const dlog = t => { const e = $('#f9dStatus', root); e.textContent = (e.textContent === 'Not connected.' ? '' : e.textContent + '\n') + t; e.scrollTop = e.scrollHeight; };
    $('#f9dTest', root).onclick = async () => { $('#f9dNote', root).textContent = 'Testing…'; $('#f9dCors', root).hidden = true; $('#f9dStatus', root).textContent = '';
      try { const core = await (await fetch(WP.base() + '/wp-json/', { mode: 'cors' })).json(); dlog(`Site: ${core.name || '?'}. REST reachable. Namespaces: ${(core.namespaces || []).filter(n => /wp\/v2|forge|elementor/.test(n)).join(', ')}`);
        if ((core.namespaces || []).includes('forge/v1')) { const s = await WP.req('GET', 'forge/v1/status'); WPSTAT = Object.assign({ bridge: true }, s); dlog(`Bridge ${s.forge} · WP ${s.wp} · PHP ${s.php} · Elementor ${s.elementor || 'none'} · containers ${s.containers ? 'on' : 'off'} · theme ${s.theme}\nSEO plugin: ${s.seo_plugin} · unfiltered_html ${s.unfiltered_html ? 'yes' : 'no, Elementor data cannot be written'} · user ${s.user}`); }
        else { const me = await WP.req('GET', 'wp/v2/users/me?context=edit'); WPSTAT = { bridge: false, user: me.slug }; dlog(`No FORGE bridge on this site. Signed in as ${me.slug}. Without the bridge only the HTML fallback and media can be sent, with no Elementor data, JSON-LD or SEO fields.`); }
        $('#f9dNote', root).textContent = 'Connected.'; $('#f9dGo', root).disabled = false; ['#f9dLinks', '#f9dIdx', '#f9dLive'].forEach(s => $(s, root).disabled = !WPSTAT.bridge);
      } catch (e) { WPSTAT = null; $('#f9dGo', root).disabled = true; $('#f9dNote', root).textContent = 'Failed.'; dlog('Error: ' + (e.message || e)); if (e instanceof TypeError || /Failed to fetch|NetworkError|Load failed/.test(String(e))) { $('#f9dCors', root).hidden = false; $('#f9dOrigin', root).textContent = location.origin; } } };
    async function wpFind(q) { try { if (WPSTAT && WPSTAT.bridge) return await WP.req('GET', 'forge/v1/media/find?q=' + encodeURIComponent(q) + '&per_page=5'); const rows = await WP.req('GET', 'wp/v2/media?search=' + encodeURIComponent(q) + '&per_page=5&_fields=id,source_url,mime_type,alt_text,media_details'); return rows.map(r => ({ id: r.id, url: r.source_url, mime: r.mime_type, alt: r.alt_text || '', width: (r.media_details || {}).width, height: (r.media_details || {}).height })); } catch (e) { return []; } }
    async function wpUpload(a, alt) { const stem = a.file.replace(/\.[^.]+$/, ''); const hit = (await wpFind(stem)).find(m => m.url && m.url.split('/').pop().replace(/\.[^.]+$/, '').startsWith(stem)); if (hit) return Object.assign({ reused: true }, hit);
      const j = await WP.req('POST', 'wp/v2/media', a.blob, { mime: a.mime, name: a.file }); try { await WP.req('POST', 'wp/v2/media/' + j.id, { alt_text: alt || a.alt || '', title: stem.replace(/-/g, ' ') }); } catch (e) { } const det = j.media_details || {}; return { id: j.id, url: j.source_url, width: det.width || a.w, height: det.height || a.h, mime: j.mime_type }; }
    async function resolveMedia(bp, notes) { const out = {}; const doMedia = $('#f9dMedia', root).checked;
      for (const [k, spec] of Object.entries(bp.media || {})) { const src = spec.source || '';
        if (/^https?:/.test(src) && spec.kind === 'video') { out[k] = { id: 0, url: src, alt: spec.alt, kind: 'video' }; continue; }
        if (src.startsWith('assets/')) { const a = ASSETS.find(x => x.file === src.slice(7)); if (!a) { notes.push(k + ': asset not loaded'); continue; } if (!doMedia) { notes.push(k + ': upload skipped'); continue; } try { if (!a.remote) a.remote = await wpUpload(a, a.alt || spec.alt); out[k] = Object.assign({}, a.remote, { alt: a.alt || spec.alt, kind: a.kind }); } catch (e) { notes.push(k + ': upload failed, ' + e.message); } continue; }
        if (src.startsWith('library:') && doMedia) { const m = (await wpFind(src.slice(8))).find(h => !h.mime || h.mime.startsWith(spec.kind === 'video' ? 'video' : 'image')); if (m) out[k] = { id: m.id, url: m.url, alt: spec.alt || m.alt, kind: spec.kind || 'image', width: m.width, height: m.height }; else notes.push(k + ': no library match for "' + src.slice(8) + '"'); } }
      return out; }
    $('#f9dGo', root).onclick = () => { if (!WPSTAT) return; ensureBuilt(); renderLedger(); if ($('#f9dPublish', root).checked && !PUBLISH_OK) { $('#f9dConfirmT', root).textContent = `Publish ${PLAN.pages.length} pages live on ${WP.base()}? Drafts are the safe default.`; $('#f9dConfirm', root).hidden = false; return; } deployAll(); };
    $('#f9dConfirmGo', root).onclick = () => { PUBLISH_OK = true; $('#f9dConfirm', root).hidden = true; deployAll(); };
    $('#f9dConfirmNo', root).onclick = () => { $('#f9dPublish', root).checked = false; $('#f9dConfirm', root).hidden = true; deployAll(); };
    async function deployAll() {
      const publish = $('#f9dPublish', root).checked && PUBLISH_OK; const btn = $('#f9dGo', root); btn.disabled = true; const tb = $('#f9dRes tbody', root); tb.innerHTML = ''; const onlyNew = $('#f9dOnlyNew', root).checked; let done = 0;
      const todo = PLAN.pages.filter(p => !(onlyNew && DEPLOYED.has(p.id) && DEPLOYED.get(p.id).id));
      for (const p of todo) { const b = BUILT.get(p.id) || buildPage(p); const notes = []; const row = el('tr', null, `<td class="l">${esc(p.label)}</td><td class="l">…</td><td class="l"></td><td class="l"></td><td></td><td class="l"></td>`); tb.appendChild(row);
        try { if (b.ch.block) throw new Error('blocked by the checks: ' + b.ch.issues.filter(i => i.sev === 'block').map(i => i.id).join(', '));
          const bp = stripBp(b.bp); const mp = await resolveMedia(bp, notes); const un = Object.keys(bp.media || {}).filter(k => !mp[k]); if (un.length) throw new Error('media unresolved: ' + un.join(', ') + '. Add an asset or a matching library image');
          const r = FC.compile(bp, mp); if (r.lint.some(l => /^BLOCK/.test(l))) throw new Error(r.lint.find(l => /^BLOCK/.test(l)));
          let res; if (WPSTAT.bridge) { const bundle = FC.bundle(bp, mp, r); bundle.status = publish ? 'publish' : 'draft'; res = await WP.req('POST', 'forge/v1/import', bundle); }
          else { const pt = bp.page.post_type === 'post' ? 'posts' : 'pages'; const ex = await WP.req('GET', `wp/v2/${pt}?slug=${encodeURIComponent(p.slug)}&status=any&_fields=id`); const body = { slug: p.slug, title: p.h1, status: publish ? 'publish' : 'draft', content: r.html, excerpt: bp.page.summary || '' }; const j = await WP.req('POST', ex.length ? `wp/v2/${pt}/${ex[0].id}` : `wp/v2/${pt}`, body); res = { id: j.id, link: j.link, edit: WP.base() + '/wp-admin/post.php?post=' + j.id + '&action=edit', status: body.status, updated: !!ex.length }; }
          DEPLOYED.set(p.id, { id: res.id, link: res.link, edit: res.edit, status: res.status || (publish ? 'publish' : 'draft'), note: notes.join('; ') });
          row.children[1].innerHTML = `<span class="pill">${esc(res.status || 'draft')}${res.updated ? ' · updated' : ''}</span>`; row.children[2].innerHTML = `<a href="${esc(res.link)}" target="_blank" rel="noopener">${esc(res.link)}</a>`; row.children[3].innerHTML = res.edit ? `<a href="${esc(res.edit)}" target="_blank" rel="noopener">Edit</a>` : ''; row.children[4].textContent = Object.keys(mp).length; row.children[5].textContent = notes.join('; ');
        } catch (e) { DEPLOYED.set(p.id, { status: 'error', note: e.message }); row.children[1].innerHTML = '<span class="pill">error</span>'; row.children[5].textContent = e.message + (notes.length ? ' · ' + notes.join('; ') : ''); }
        done++; }
      btn.disabled = false; renderLedger(); dlog(`Deployed ${done} pages${publish ? ', published' : ' as drafts'}.`); }
    $('#f9dLive', root).onclick = async () => { try { const j = await WP.req('GET', 'forge/v1/urls'); const txt = (j.urls || []).join('\n'); $('#f9Live', root).value = txt; S().live = txt; LIVE = E.parseLive(txt, S().url); save(); renderLive(); rebuildBuilt(); dlog(`Live URLs refreshed from the site: ${j.count || (j.urls || []).length}.`); } catch (e) { dlog('Could not read live URLs: ' + e.message); } };
    $('#f9dLinks', root).onclick = async () => { try { const j = await WP.req('GET', 'forge/v1/urls'); const live = new Set((j.urls || []).map(u => { try { return new URL(u).pathname.replace(/\/?$/, '/'); } catch (e) { return u; } })); let bad = 0, tot = 0; PLAN.pages.forEach(p => { const b = BUILT.get(p.id); if (!b) return; b.bp.page.internal_links.forEach(l => { tot++; if (!live.has(l.url.replace(/\/?$/, '/'))) bad++; }); }); dlog(`Live URLs on the site: ${live.size}. Internal links in the plan: ${tot}; not live: ${bad}${bad ? '. Refresh the live URLs and rebuild before publishing' : ''}.`); } catch (e) { dlog('Link check failed: ' + e.message); } };
    $('#f9dIdx', root).onclick = async () => { const urls = [...DEPLOYED.values()].filter(d => d.status === 'publish' && d.link).map(d => d.link); if (!urls.length) { dlog('Nothing published yet.'); return; } try { const j = await WP.req('POST', 'forge/v1/indexnow', { urls }); dlog(`IndexNow: ${j.sent} URLs sent, response ${j.code}.`); } catch (e) { dlog('IndexNow failed: ' + e.message + '. Set an IndexNow key in the bridge settings first.'); } };

    /* ---------- exports ---------- */
    const ymd = () => new Date().toISOString().slice(0, 10);
    function cliText() { const site = S().url || 'https://www.example.com'; const first = PLAN.pages[0] ? PLAN.pages[0].slug : 'home';
      return `export WP_URL=${S().cms || site} WP_USER=<user> WP_APP_PASS='<application password>'
python3 forge_wp.py status
python3 forge_wp.py bridge-zip
for f in pack/blueprints/*.blueprint.json; do s=$(basename $f .blueprint.json); python3 forge_wp.py media-resolve $f pack/media/$s.media.json --assets pack --reuse && python3 forge_compile.py $f out --media pack/media/$s.media.json && python3 forge_wp.py links-check $f --base ${site} && python3 forge_wp.py import out/$s.bundle.json --media pack/media/$s.media.json; done
# one page: python3 forge_compile.py pack/blueprints/${first}.blueprint.json out`; }
    const csvRow = a => a.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',');
    function ledgerCSV() { ensureBuilt(); return '﻿' + ['type,label,slug,title,title_len,h1,meta,meta_len,words,blocks,warnings,internal_links,deploy_status,link'].concat(PLAN.pages.map(p => { const b = BUILT.get(p.id); const d = DEPLOYED.get(p.id) || {}; return csvRow([E.KL[p.kind], p.label, '/' + p.slug + '/', p.title, p.title.length, p.h1, p.meta, p.meta.length, b.words, b.ch.block, b.ch.warn, b.bp.page.internal_links.length, d.status || '', d.link || '']); })).join('\n'); }
    async function assetBytes(a) { return new Uint8Array(await a.blob.arrayBuffer()); }
    $('#f9Pack', root).onclick = async () => { ensureBuilt(); renderKpis(); renderLedger(); const files = []; const planJ = { v: 1, saved: new Date().toISOString(), cfg: CFG, pages: PLAN.pages.map(p => ({ id: p.id, kind: p.kind, slug: p.slug, title: p.title, h1: p.h1, meta: p.meta, label: p.label, lang: p.lang })) };
      files.push({ name: 'pack/plan.json', data: JSON.stringify(planJ, null, 1) });
      files.push({ name: 'pack/README.md', data: `# Site Forge pack\n\n${PLAN.pages.length} pages for ${S().brand}, built ${ymd()} by the DFW Thermal Debt Atlas, module 09.\n\nFolders: blueprints (source of truth), bundles (what the bridge imports, media unresolved), elementor (templates for Templates, Saved Templates, Import), html (semantic fallback), preview (open in a browser), schema (JSON-LD), assets (WebP images and video), media (per page media maps to fill). forge-bridge.php is the WordPress plugin.\n\nInternal links point only at URLs that were live on the pasted sitemap. Re-run links-check before publishing.\n\n\`\`\`\n${cliText()}\n\`\`\`\n` });
      files.push({ name: 'pack/forge-bridge.php', data: FORGE_BRIDGE_PHP }); files.push({ name: 'pack/ledger.csv', data: ledgerCSV() });
      for (const p of PLAN.pages) { const b = BUILT.get(p.id); const bp = stripBp(b.bp); files.push({ name: `pack/blueprints/${p.slug}.blueprint.json`, data: JSON.stringify(bp, null, 1) }); const r0 = FC.compile(bp, {}); files.push({ name: `pack/bundles/${p.slug}.bundle.json`, data: JSON.stringify(FC.bundle(bp, {}, r0)) }); files.push({ name: `pack/elementor/${p.slug}.elementor-template.json`, data: JSON.stringify(r0.template) }); files.push({ name: `pack/html/${p.slug}.content.html`, data: r0.html }); files.push({ name: `pack/preview/${p.slug}.preview.html`, data: r0.preview }); files.push({ name: `pack/schema/${p.slug}.schema.json`, data: JSON.stringify(r0.schema, null, 1) }); files.push({ name: `pack/media/${p.slug}.media.json`, data: '{}' }); }
      for (const a of ASSETS) files.push({ name: 'pack/assets/' + a.file, data: await assetBytes(a) });
      saveFile(`site-forge-pack_${slug(S().brand || 'site')}_${ymd()}.zip`, zipBlob(files)); };
    $('#f9ElZ', root).onclick = () => { ensureBuilt(); saveFile('site-forge-elementor-templates.zip', zipBlob(PLAN.pages.map(p => ({ name: `elementor/${p.slug}.elementor-template.json`, data: JSON.stringify(BUILT.get(p.id).r.template) })))); };
    $('#f9BpZ', root).onclick = () => { ensureBuilt(); saveFile('site-forge-blueprints.zip', zipBlob(PLAN.pages.map(p => ({ name: `blueprints/${p.slug}.blueprint.json`, data: JSON.stringify(stripBp(BUILT.get(p.id).bp), null, 1) })))); };
    $('#f9Bridge', root).onclick = () => saveFile('forge-bridge.zip', zipBlob([{ name: 'forge-bridge/forge-bridge.php', data: FORGE_BRIDGE_PHP }]));
    $('#f9LedX', root).onclick = () => saveFile('site-forge-ledger.csv', ledgerCSV());
    $('#f9Save', root).onclick = () => { readSite(); readFocus(); saveFile(`site-forge-plan_${slug(S().brand || 'site')}.json`, JSON.stringify({ v: 1, saved: new Date().toISOString(), cfg: CFG, deployed: [...DEPLOYED.entries()] }, null, 1)); };
    $('#f9Load', root).onclick = () => $('#f9LoadF', root).click();
    $('#f9LoadF', root).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const o = JSON.parse(await f.text()); CFG = merge(E.defaultCfg(), o.cfg || o); if (o.deployed) DEPLOYED = new Map(o.deployed); LIVE = E.parseLive(CFG.site.live, CFG.site.url); BUILT = new Map(); writeSite(); syncFocus(); syncBuild(); $('#f9Live', root).value = CFG.site.live || ''; renderLive(); save(); replan(); toast('Plan loaded'); } catch (err) { toast('Not a Site Forge plan: ' + err.message); } e.target.value = ''; };

    /* ---------- method ---------- */
    function renderMethod() {
      const V = E.baseVars(CFG, PLAN.markets); const keys = ['ac_life', 'furn_life', 'hp_life', 'mrl15', 'm_ge15', 'm_r22', 'm_rep', 'ticket', 'd100', 'cdd', 'fwheat', 'r22stop', 'a2l', 'uri'];
      const rows = keys.map(k => E.factItem(k, V)).filter(Boolean).map(f => [esc(f.value), esc(f.label), esc(f.source), G(f.grade)]);
      rows.push(['per city', 'systems, share 15 or older, R22 era, builder originals, furnaces 20 or older, heat pump share', 'Estimate from Census housing data and EIA RECS 2020 equipment ages', G('C')], ['per city', 'median year built, gas heat, rented share, build decades', 'U.S. Census Bureau, American Community Survey 2020 to 2024', G('A')], ['per county', 'hail reports since 2016, largest stone', 'NOAA Storm Events Database', G('A')], ['per county', 'active contractor and technician licenses', 'Texas Department of Licensing and Regulation', G('A')]);
      $('#f9Method', root).innerHTML = `<div class="grid2"><div>${judgList([
        ['Pages', 'Each page is a FORGE blueprint: one JSON document naming the archetype, the entity, the call to action and form, the media slots and an ordered list of sections. The same blueprint compiles to Elementor flex containers, semantic HTML and JSON-LD here and in the FORGE skill\'s Python compiler.'],
        ['Copy', `Service copy is written per angle, the same angles the Campaign Desk advertises, with the numbers that decide the job: system age, refrigerant era, heating fuel, hail, and what local permits show a replacement costs. City and county pages are written from that place's own figures; guides from the replacement model, the permit records and the DFW climate record through ${esc(V.throughFull)}.`],
        ['Standard', 'Title of 60 characters or fewer, meta of 120 to 158, one H1 of 70 or fewer, an answer capsule under the hero, sourced key facts, a FAQ of real questions, a primary call to action with the phone, a sticky mobile bar, a consent form with an unchecked box, the TDLR license in the trust strip and footer, and the TDLR consumer notice on every page.'],
        ['Links', 'Internal links come only from the live URLs pasted in step 4, scored by how well the path matches the page\'s topic and city. Pages in the plan link to each other only after they are live. Breadcrumbs name Home only when the home page is on the live list.'],
        ['Checks', 'Every text field runs the Satchel rule pack (TDLR, FTC and DTPA, Regulation Z, TCPA, the refrigerant and efficiency rules) and the house style; the page source runs the web rules (license present, no self served ratings, no prechecked consent). A block stops deploy.']])}</div>
        <div><div class="xscroll"><table class="prose"><thead><tr><th>Value</th><th>Fact as printed</th><th>Source printed on the page</th><th>Grade</th></tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>
        ${callout('judg', 'Judgment calls to check before publishing', judgList([
          ['Benchmark defaults', `The site fields open with ${esc((BENCH || {}).name || 'the benchmark')} from the heatmap: phone, street (with "Suite" spelled out to keep the footer free of hyphens), license ${esc(S().lic)}, hours "${esc(S().hours)}" from the heatmap's notes, equipment "${esc(S().brands)}", and the ${esc(S().plan)} plan name. Confirm each against the business before anything deploys.`],
          ['Costs are permit declared values', `The cost figure is the median declared valuation on ${N(DATA.tickets.n)} full system replacement permits in Irving, 2022 to 2025. Declared values track contract prices loosely; the page says "declared value", never "price".`],
          ['Estimates are labeled as estimates', 'System ages, R22 counts and furnace ages come from the atlas\'s renewal model (grade C). Pages attribute them to "Census housing data and EIA RECS 2020 equipment ages" and say "estimated"; the grade stays here.'],
          ['Permit statement is hedged', 'Pages say "most Dallas Fort Worth cities" require a mechanical permit for a changeout; the forge has not read every city\'s code.'],
          ['No reviews, no ratings', 'The forge writes no testimonial and puts no review count or aggregateRating on a page. Paste real reviews with permission to show them.'],
          ['Conservative page count', 'Eight cities plus the office city, and the per city build year guide off by default. Templated location pages are the pattern search engines treat as doorways; add cities only where the numbers differ.'],
          ['Landing pages are noindex', 'Campaign landing pages duplicate the city pages\' intent; they stay out of the index unless you untick the option.'],
          ['Slugs keep hyphens', 'URL slugs use hyphens as separators, which is how WordPress builds them; no hyphen appears in visible copy.']]))}
        ${callout('note', 'Hand-off to the FORGE skill', `Download the pack, unzip it beside the FORGE toolkit and run the commands in its README, or paste them into a Claude session that has the forge skill: it resolves media, checks every internal link against the live sitemap, imports each page as a draft through the bridge and reports the links. The pack's plan.json reloads here with ⤒ Load.<pre style="margin-top:8px">${esc(cliText())}</pre>`)}
        <div class="dsec" style="margin-top:14px">Sources</div>${srcRows([
          ['TDLR advertising rule', '16 Tex. Admin. Code §75.71 (Cornell LII)', 'A', 'read Sep 25, 2026', 'https://www.law.cornell.edu/regulations/texas/16-Tex-Admin-Code-SS-75-71'],
          ['Equipment lifetimes', 'EIA Residential Energy Consumption Survey 2020, public microdata', 'B', '2020 survey', 'https://www.eia.gov/consumption/residential/data/2020/'],
          ['Housing and heating fuel', 'U.S. Census Bureau, ACS 2020 to 2024 five year tables', 'A', '2024', 'https://www2.census.gov/programs-surveys/acs/summary_file/'],
          ['Climate', 'NOAA GHCN Daily, DFW Airport (USW00003927)', 'A', V.throughFull, 'https://www.ncei.noaa.gov/pub/data/ghcn/daily/by_station/'],
          ['Hail', 'NOAA Storm Events Database', 'A', '2016 to 2026', 'https://www.ncei.noaa.gov/stormevents/'],
          ['Permit values', 'City of Irving open data, mechanical permits', 'B', '2022 to 2025', ''],
          ['Refrigerant rules', 'NAHB summary of the EPA final rule on R410A installation and the A2L transition', 'B', 'May 2026', 'https://www.nahb.org/blog/2026/05/epa-hvac-refrigerants-r-410a-final-rule'],
          ['Schema', 'schema.org HVACBusiness', 'A', '', 'https://schema.org/HVACBusiness']])}`;
    }

    /* ---------- hooks ---------- */
    this.receive = p => { if (!p) return; let names = []; if (p.zips && p.zips.length) names = citiesFromZips(p.zips); if (p.cities && p.cities.length) names = p.cities.filter(n => FORGE.CITY[n]); if (names.length) { CFG.focus.scope = 'pick'; CFG.focus.picks = names; syncFocus(); save(); replan(); toast(`${names.length} cities received from ${p.zips ? p.zips.length + ' ZIPs' : 'the list'}`); } };
    this.feed = () => { ensureBuilt(); return PLAN.pages.map(p => { const b = BUILT.get(p.id); return { label: `Site Forge · ${E.KL[p.kind]} · ${p.label}`, text: E.pageText(b.bp).map(x => x[1]).join('\n'), html: b.r.html + '\n' + JSON.stringify(b.r.schema), plat: 'web', page: true }; }); };
    this.onShow = () => { };
    /* ---------- hand-off to module 16 (Publish): every built page as a portable page with its media, for any CMS ---------- */
    this.publishPages = () => { ensureBuilt(); return PLAN.pages.map(p => { const b = BUILT.get(p.id); const bp = stripBp(b.bp); const media = {}, forCompile = {};
        for (const [k, spec] of Object.entries(bp.media || {})) { const src = spec.source || '';
          if (/^https?:/.test(src)) { media[k] = forCompile[k] = { id: 0, url: src, alt: spec.alt || '', kind: spec.kind || 'video' }; }
          else if (src.startsWith('assets/')) { const a = ASSETS.find(x => x.file === src.slice(7)); if (a) { forCompile[k] = { id: 0, url: a.url, alt: a.alt || spec.alt || '', kind: a.kind, width: a.w, height: a.h }; media[k] = Object.assign({}, forCompile[k], { mime: a.mime, asset: { blob: a.blob, file: a.file, mime: a.mime } }); } else media[k] = { id: 0, url: '', alt: spec.alt || '', kind: spec.kind || 'image', missing: src }; }
          else if (src.startsWith('library:')) media[k] = { id: 0, url: '', alt: spec.alt || '', kind: spec.kind || 'image', library: src.slice(8) }; }
        const r = FC.compile(bp, forCompile);
        return CMS.pageFromForge(bp, r, media, { label: p.label, kind: E.KL[p.kind], forgeId: p.id, checks: b.ch, words: b.words }); }); };
    this.publishAssets = () => ASSETS.slice();
    this.publishSite = () => Object.assign({}, S());

    /* ---------- boot ---------- */
    writeSite(); syncFocus(); syncBuild(); $('#f9Live', root).value = S().live || ''; renderLive(); $('#f9dUrl', root).value = S().cms || S().url || '';
    replan(); renderMedia(); renderMethod();
    PLAN.pages.forEach(p => buildPage(p)); renderKpis(); renderLedger(); if (PLAN.pages.length) openPage(PLAN.pages.find(p => p.kind === 'city') ? PLAN.pages.find(p => p.kind === 'city').id : PLAN.pages[0].id, true);
    BUS.on('theme', () => renderFocus());
  }
});
