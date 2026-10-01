'use strict';
/* Module 10: Campaign Desk. The plan (geography, lines, budget allocation by expected matters times value, ZIP or county targets with
   criterion IDs and bid steps, keyword sets with local modifiers, platform split and benchmarks, flight and pacing) and a bulk file or
   build sheet for nine ad platforms, written by DESKX (src/10_desk_platforms.js). Creative is screened with LINT before it leaves; the
   firm comes from FIRM; Accounts actuals (ACCT) and Live Desk timing (LIVE) correct the assumptions when those layers are present.
   Only the plan's inputs are saved ('sev.desk'); everything derived is rebuilt on render. */
const DK_KEYS = ['geo', 'scope', 'counties', 'picks', 'n', 'minhh', 'alpha', 'lines', 'shares', 'values', 'budget', 'start', 'weeks', 'sched', 'es', 'esShare', 'metaGeo', 'radius', 'li', 'pay', 'mix', 'asm', 'ov', 'useAct', 'live', 'watchBid', 'bids'];
function dkDefaults() {
  const F = FIRM.get(); const fl = FIRM.lines().filter(k => LINE_META[k]);
  return { v: 2, geo: 'msa:19100', scope: 'top', counties: [], picks: [], n: 30, minhh: 0, alpha: 1, lines: fl.length ? fl : ['div_k', 'div_nk', 'sapcr', 'mod'], shares: null, values: {}, budget: 12000, start: todayISO(), weeks: 13, sched: 'extended', es: (F.languages || []).includes('es'), esShare: 25, metaGeo: 'zips', radius: 15, li: 'both', pay: '', mix: null, asm: null, ov: { name: '', atty: '', city: '', phone: '', url: '' }, useAct: {}, live: true, watchBid: false, bids: null };
}
/* keep only the inputs, with their types; anything else in a saved or loaded plan (build 1 kept _kw, _plan and _zips) is dropped */
function dkSanitize(o) {
  const d = dkDefaults(); const P = {}; o = o && typeof o === 'object' ? o : {};
  const num = (v, a, b, def) => { v = +v; return isFinite(v) ? clamp(v, a, b) : def; };
  const geoOk = g => { const [t, id] = String(g || '').split(':'); return (t === 'msa' && MSA[id]) || (t === 'cty' && CI[id]); };
  P.v = 2; P.geo = geoOk(o.geo) ? o.geo : d.geo; P.scope = ['top', 'metro', 'counties', 'picks'].includes(o.scope) ? o.scope : d.scope;
  P.counties = Array.isArray(o.counties) ? o.counties.filter(f => CI[f]) : []; P.picks = Array.isArray(o.picks) ? o.picks.map(String).filter(z => ZI[z]) : [];
  P.n = Math.round(num(o.n, 1, 300, d.n)); P.minhh = num(o.minhh, 0, 100000, 0); P.alpha = num(o.alpha, 0.5, 2.5, d.alpha);
  P.lines = Array.isArray(o.lines) ? o.lines.filter(k => LINE_META[k]) : d.lines;   // an empty list is allowed (the desk shows an empty state)
  P.shares = o.shares && typeof o.shares === 'object' ? Object.fromEntries(Object.entries(o.shares).filter(([k, v]) => LINE_META[k] && isFinite(+v)).map(([k, v]) => [k, clamp(+v, 0, 100)])) : null;
  P.values = o.values && typeof o.values === 'object' ? Object.fromEntries(Object.entries(o.values).filter(([k, v]) => LINE_META[k] && +v > 0).map(([k, v]) => [k, +v])) : {};
  P.budget = num(o.budget, 0, 10000000, d.budget); P.start = /^\d{4}-\d{2}-\d{2}$/.test(String(o.start || '')) ? o.start : d.start; P.weeks = Math.round(num(o.weeks, 1, 52, d.weeks));
  P.sched = DESKX.SCHED[o.sched] ? o.sched : d.sched; P.es = typeof o.es === 'boolean' ? o.es : d.es; P.esShare = num(o.esShare, 5, 60, d.esShare);
  P.metaGeo = o.metaGeo === 'radius' ? 'radius' : 'zips'; P.radius = Math.round(num(o.radius, 1, 50, d.radius)); P.li = ['both', 'recruit', 'referral'].includes(o.li) ? o.li : d.li; P.pay = typeof o.pay === 'string' ? o.pay.slice(0, 80) : '';
  P.mix = o.mix && typeof o.mix === 'object' ? Object.fromEntries(DESKX.PLATS.map(p => [p, num(o.mix[p], 0, 100, 0)])) : null;
  P.asm = o.asm && typeof o.asm === 'object' ? Object.fromEntries(DESKX.PLATS.map(p => { const a = Object.assign({}, DESKX.ASM0[p]), s = o.asm[p] || {}; ['cost', 'ctr', 'cvr', 'ret', 'min'].forEach(k => { if (isFinite(+s[k]) && s[k] !== '' && s[k] != null) a[k] = Math.max(0, +s[k]); }); return [p, a]; })) : null;
  P.ov = Object.assign({}, d.ov); if (o.ov && typeof o.ov === 'object') Object.keys(P.ov).forEach(k => { if (typeof o.ov[k] === 'string') P.ov[k] = o.ov[k].slice(0, 120); });
  P.useAct = o.useAct && typeof o.useAct === 'object' ? Object.fromEntries(Object.entries(o.useAct).filter(([k, v]) => LINE_META[k] && typeof v === 'boolean')) : {};   // true or false by choice; absent follows Accounts' Apply
  P.live = o.live !== false; P.watchBid = o.watchBid === true; P.bids = o.bids && typeof o.bids === 'object' ? Object.fromEntries(Object.entries(o.bids).filter(([z, v]) => ZI[z] && isFinite(+v)).map(([z, v]) => [z, clamp(+v, -90, 900)])) : null;
  return P;
}
const DK_SEAS = l => ({ div_k: 'div_k', div_nk: 'div', sapcr: 'sapcr', po: 'po', mod: 'mod', enf: 'enf', ivd: 'ivd' }[l] || 'div');
const DK_ALLOC = l => ({ div_k: 'div_k', div_nk: 'div', sapcr: 'sapcr', po: 'po', mod: 'mod', enf: 'enf', ivd: 'ivd' }[l] || 'div');
const DK_PCT = (v, d) => P(v, d);   // the global percent formatter; mount() shadows P with the plan
const DK_BID = v => (v > 0 ? '+' : v < 0 ? '\u2212' : '') + Math.abs(Math.round(v || 0)) + '%';
const DK_TAB = { '19100': 'DFW', '26420': 'HOU', '41700': 'SAT', '12420': 'AUS', '21340': 'ELP', '32580': 'RGV', '15180': 'RGV' };
registerModule({
  key: 'desk', num: '10', title: 'Campaign Desk', desc: 'Budgets, ZIP targets, keywords, creative and a bulk file or build sheet for nine ad platforms, screened against the Texas advertising rules',
  mount(root) {
    const self = this;
    let P = dkSanitize(store.get('sev.desk', {}));
    const UI = { plat: 'google', line: null, lang: 'en', prev: '', tab: 'platforms', kwLine: null, kwLang: 'en', scr: 'issues' };
    const save = () => store.set('sev.desk', P);
    const asmOf = () => P.asm || JSON.parse(JSON.stringify(DESKX.ASM0));
    const hasACCT = () => typeof ACCT !== 'undefined' && ACCT && typeof ACCT.rates === 'function';
    const hasLIVE = () => typeof LIVE !== 'undefined' && LIVE && typeof LIVE.timing === 'function';
    const hasWATCH = () => typeof WATCH !== 'undefined' && WATCH && typeof WATCH.activity === 'function';
    /* Competitor Watch: live rival ads the firm has logged in the last 120 days, by county and line ({fips: {_all, line: n}}) */
    const watchAct = () => { if (!hasWATCH()) return null; try { return WATCH.activity() || {}; } catch (e) { return null; } };
    const nZipIds = ZC.filter(z => z.gt).length;
    const geoOpts = Object.keys(MSA).sort((a, b) => MSA[b].pop2025 - MSA[a].pop2025).map(k => ['msa:' + k, 'Metro: ' + MNAME(MSA[k].title)]).concat(CTY.slice().sort((a, b) => b.pop2025 - a.pop2025).map(c => ['cty:' + c.fips, c.name + ' County']));
    const FILES = [['dkG', 'google', 'Google Ads'], ['dkL', 'lsa', 'Local Services'], ['dkDg', 'dg', 'YouTube, Demand Gen'], ['dkM', 'meta', 'Meta'], ['dkMs', 'microsoft', 'Microsoft'], ['dkLi', 'linkedin', 'LinkedIn'], ['dkY', 'yelp', 'Yelp'], ['dkNd', 'nextdoor', 'Nextdoor'], ['dkTt', 'tiktok', 'TikTok']];
    root.innerHTML = mastHTML({ eyebrow: 'Module 10 · Campaign Desk · plans and bulk files built from the modules before it', title: 'Campaign Desk', dek: `Pick a metro or county, the lines to sell, a budget and a flight. The desk allocates the budget by expected filings times matter value, shortlists ZIPs by efficiency (or targets whole counties), splits the money across nine ad platforms on benchmarks you can edit, paces it to the season each line actually files in, writes keyword sets with the local city and county modifiers and creative in Texas terms to every platform's limits, screens every ad against the Texas advertising rules, and writes the file each platform imports. Filings come from module 02, pools from 06, ZIPs from 07, seasons from 09; the firm comes from the firm profile.`, facts: [['13', 'service lines'], [N(nZipIds), 'metro ZIPs with Google criterion IDs'], ['9', 'platforms, each with a bulk file or build sheet, every object paused'], ['Rule 7.02(a)', 'every ad names a responsible lawyer and a primary practice location, or says the landing page does']] }) + `
    ${toolbarHTML('Campaign Desk', 'Plan, keywords, copy, calendar', [{ id: 'dkPlanX', label: '↓ Plan CSV' }, { id: 'dkKw', label: '↓ Keywords CSV' }, { id: 'dkNeg', label: '↓ Negatives' }, { id: 'dkZip', label: '↓ ZIP targets' }, { id: 'dkFl', label: '↓ Flight CSV' }, { id: 'dkCr', label: '↓ Creative library' }, { id: 'dkSave', label: '⤓ Save plan' }, { id: 'dkLoad', label: '⤒ Load plan' }])}
    <div class="dk-files"><span class="dk-lbl">Bulk files and build sheets, every campaign and ad paused:</span>${FILES.map(f => `<button type="button" class="btn sm" id="${f[0]}">↓ ${esc(f[2])}</button>`).join('')}<button type="button" class="btn sm primary" id="dkAll">↓ All files (zip)</button></div>
    ${callout('note', 'Read this first: what the desk does and does not do', `<p>The desk turns the atlas into media buys for one Texas family law firm: a budget split by line and platform and paced to the filing season, location targets with each platform's own identifiers (Google criterion IDs for ${N(nZipIds)} of ${N(ZC.length)} metro ZIPs and every county), keyword and negative sets, creative written to every platform's character limits, and a bulk file or build sheet per platform. Every ad is screened by the compliance engine (the Texas Disciplinary Rules 7.01 to 7.06, the family law myths, the house style); an ad with a blocking finding is exported as <b>needs review</b> with the findings in a notes column. It does <b>not</b> connect to an ad account, pull keyword volumes, file anything with the Advertising Review Committee or decide that an ad is lawful: the numbers are stated assumptions with grades, the files land paused, and a lawyer reviews them before anything spends.</p>`)}
    <div id="dkFirmNote"></div>
    <div class="panel" style="margin-bottom:14px"><h3>The plan</h3><div class="sub">Change anything and the desk rebuilds. Only these inputs are saved in this browser; Save plan writes them to a file.</div>
      <div class="formgrid">
        <div class="ctl"><label for="dkGeo">Geography</label>${sel('dkGeo', geoOpts, P.geo).replace('<select id="dkGeo">', '<select id="dkGeo" aria-describedby="dkGeoHint">')}<span class="hint" id="dkGeoHint">A metro (ZIPs and counties) or one county.</span></div>
        <div class="ctl"><label for="dkScope">Market scope</label><select id="dkScope"><option value="top">Top ZIPs by efficiency</option><option value="metro">Every ZIP in the geography</option><option value="counties">Counties (county targets)</option><option value="picks">Hand picked ZIPs</option></select></div>
        <div class="ctl"><label for="dkCounties">Counties (none picked means all)</label><select id="dkCounties" multiple size="4"></select></div>
        <div class="ctl"><label for="dkPicks">Hand picked ZIPs</label><input type="text" id="dkPicks" placeholder="75024, 75093, 75034"><span class="hint">Other modules can send ZIPs here.</span></div>
        <div class="ctl"><label for="dkN">ZIPs to buy (top scope)</label><input type="number" id="dkN" min="1" max="300" step="1"></div>
        <div class="ctl"><label for="dkMin">Minimum households in a ZIP</label><select id="dkMin"><option value="0">Any</option><option value="1000">1,000 or more</option><option value="2000">2,000 or more</option><option value="5000">5,000 or more</option><option value="10000">10,000 or more</option></select></div>
        <div class="ctl"><label for="dkAlpha">Concentration α <span id="dkAlphaV"></span></label><input type="range" id="dkAlpha" min="0.5" max="2.5" step="0.1"><span class="hint">1 spends in proportion to expected filings; 2 concentrates on the biggest ZIPs.</span></div>
        <div class="ctl"><label for="dkBudget">Monthly budget $ (media)</label><input type="number" id="dkBudget" min="0" step="500"></div>
        <div class="ctl"><label for="dkStart">Flight start</label><input type="date" id="dkStart"><span class="hint" id="dkStartHint"></span></div>
        <div class="ctl"><label for="dkWeeks">Flight weeks</label><input type="number" id="dkWeeks" min="1" max="52" step="1"></div>
        <div class="ctl"><label for="dkSched">Ad schedule (Search)</label><select id="dkSched">${Object.keys(DESKX.SCHED).map(k => `<option value="${k}">${esc(DESKX.SCHED[k].label)}</option>`).join('')}</select></div>
        <div class="ctl"><label for="dkMetaGeo">Meta targeting</label><select id="dkMetaGeo"><option value="zips">ZIP list from the plan</option><option value="radius">Radius around each office</option></select></div>
        <div class="ctl"><label for="dkRadius">Radius (miles)</label><input type="number" id="dkRadius" min="1" max="50" step="1"></div>
        <div class="ctl"><label for="dkLiUse">LinkedIn campaigns</label><select id="dkLiUse"><option value="both">Recruiting and referral partners</option><option value="recruit">Attorney and paralegal recruiting</option><option value="referral">Referral partners</option></select></div>
        <div class="ctl"><label for="dkPay">Recruiting pay range</label><input type="text" id="dkPay" placeholder="$70,000 to $95,000"><span class="hint">Optional; posted in the recruiting ad when it fits.</span></div>
        <div class="ctl"><label for="dkEsShare">Spanish share of each budget (%)</label><input type="number" id="dkEsShare" min="5" max="60" step="5"></div>
      </div>
      <div class="btnrow"><label class="chk"><input type="checkbox" id="dkEs"> Spanish campaigns alongside the English ones</label><label class="chk"><input type="checkbox" id="dkLive"> Weight the flight by the Live Desk timing when it is present</label><label class="chk"><input type="checkbox" id="dkWatchBid"> Lower bid steps where Competitor Watch logs rival ads for these lines</label></div>
      <div class="dk-sec">Service lines</div><div class="btnrow" id="dkLines">${Object.keys(LINE_META).map(k => `<label class="chk"><input type="checkbox" data-l="${k}"> ${esc(LINE_META[k].short)}</label>`).join('')}</div>
      <div class="dk-sec">Firm overrides <span class="dk-mute">(empty fields read the firm profile; overrides change this desk's copy only)</span></div>
      <div class="formgrid">${[['name', 'Firm name in ads', 'name'], ['atty', 'Responsible attorney', 'atty'], ['city', 'Primary office city', 'city'], ['phone', 'Call asset phone', 'phone'], ['url', 'Landing site URL', 'url']].map(f => `<div class="ctl"><label for="dkOv_${f[0]}">${f[1]}</label><input type="text" id="dkOv_${f[0]}" data-ov="${f[0]}"></div>`).join('')}</div>
      <div class="dk-sec">Platform split (% of budget)</div><div class="dk-mix" id="dkMix"></div><div class="btnrow"><button type="button" class="btn sm" id="dkMixReset">Reset the split to the line default</button><span class="small" id="dkMixNote"></span></div>
      <div class="dk-sec">Benchmarks and assumptions (editable)</div><div id="dkAsm"></div>
    </div>
    <div id="dkAct"></div>
    <div class="tiles" id="dkTiles"></div>
    <div class="grid2"><div class="panel"><h3>Markets in the buy</h3><div class="sub" id="dkMapSub"></div><div class="mapwrap" id="dkMap"></div></div>
      <div class="panel"><h3>Plan summary</h3><div class="tabs" id="dkTabs"><button type="button" data-v="platforms" class="on">Platforms</button><button type="button" data-v="flight">Flight and pacing</button><button type="button" data-v="objects">Campaign objects</button><button type="button" data-v="rivals">Competitors</button></div><div id="dkTab"></div></div></div>
    <div class="panel" style="margin-bottom:14px"><h3>Budget by line</h3><div class="sub">Share follows expected matters times value per matter; edit a share (the others rescale around it) or a value to override.</div><div id="dkAlloc"></div></div>
    <div class="panel" style="margin-bottom:14px"><h3 id="dkZipH">ZIP targets</h3><div class="sub" id="dkZipSub"></div><div id="dkZips"></div></div>
    <div class="panel" style="margin-bottom:14px"><h3>Platform builders: what each file creates</h3><div class="sub">Structure, targeting and the rules that bind the buy, with the creative for one line, character counts against the platform's limits and the compliance screen.</div>
      <div class="tabs" id="dkPTabs">${DESKX.PLATS.map((p, i) => `<button type="button" data-v="${p}" class="${i ? '' : 'on'}">${esc(DESKX.PLAB[p])}</button>`).join('')}</div>
      <div class="controls"><div class="ctl"><label for="dkBLine">Line</label><select id="dkBLine"></select></div><div class="ctl"><label for="dkBLang">Language</label><select id="dkBLang"><option value="en">English</option><option value="es">Spanish</option></select></div><div class="ctl"><label for="dkPrev">Preview market</label><select id="dkPrev"></select></div></div>
      <div id="dkBuild"></div></div>
    <div class="panel" style="margin-bottom:14px"><h3>Keyword sets and copy</h3><div class="sub">Seeds from module 06 crossed with the local modifiers. Core seeds go in exact and phrase, questions in phrase, the city and county forms in exact. Nothing here was priced by a keyword tool; price the set in Keyword Planner inside the account.</div><div id="dkKeys"></div>
      <div class="controls" style="margin-top:12px"><div class="ctl"><label for="dkKwLine">Keyword desk: line</label><select id="dkKwLine"></select></div><div class="ctl"><label for="dkKwLang">Language</label><select id="dkKwLang"><option value="en">English</option><option value="es">Spanish</option></select></div></div><div id="dkKwOut"></div></div>
    <div class="panel" style="margin-bottom:14px"><h3>Month plan</h3><div class="sub" id="dkMonthsSub"></div><div id="dkMonths"></div></div>
    <div class="panel" style="margin-bottom:14px" id="dkScreenP"><h3>Screen all creative</h3><div class="sub">Every ad the files carry, screened with the compliance engine (LINT.checkAd: the platform's character limits plus LINT.screen). Block findings export the ad as needs review.</div>
      <div class="btnrow"><button type="button" class="btn primary" id="dkScreen">Screen all creative</button><div class="seg" id="dkScrSeg" role="group"><button type="button" data-v="issues" aria-pressed="true">Needs review</button><button type="button" data-v="findings" aria-pressed="false">Any finding</button><button type="button" data-v="all" aria-pressed="false">All ads</button></div><button type="button" class="btn sm" id="dkScrCsv">↓ Findings CSV</button></div><div id="dkScrSum" class="small"></div><div id="dkScrOut"></div></div>
    <div class="grid2"><div class="panel"><h3>Measurement, naming and operating rules</h3><div id="dkMeas"></div></div><div class="panel"><h3>Live timing</h3><div class="sub">The Live Desk's day by day multiplier per line, when it is present.</div><div id="dkLiveOut"></div></div></div>
    <div class="panel" style="margin-bottom:14px"><h3>Compliance: the rules that bind this buy</h3><div class="sub">The Texas rules and family law facts the compliance engine checks, and each platform's own policies.</div><div id="dkComp"></div></div>
    <div class="grid2"><div class="panel"><h3>How the desk is built</h3><ol class="dk-ol" id="dkHow"></ol></div><div class="panel"><h3>Judgment calls</h3><div id="dkJudg"></div></div></div>`;
    const $r = s => $(s, root); const $$r = s => $$(s, root);

    // ---------- model ----------
    function geoObj() {
      const [t, id] = P.geo.split(':');
      if (t === 'msa') { const m = MSA[id]; return { type: 'msa', id, title: MNAME(m.title), code: DK_TAB[id] || slug(MNAME(m.title).split(' / ')[0]).replace(/-/g, '').toUpperCase().slice(0, 10), metro: id, counties: m.counties.map(f => CI[f]).filter(Boolean).sort((a, b) => (b.pop2025 || 0) - (a.pop2025 || 0)), zips: metroZctas([id]) };
      }
      const c = CI[id]; return { type: 'cty', id, title: c.name + ' County', code: slug(c.name).replace(/-/g, '').toUpperCase().slice(0, 10) + 'CO', metro: c.msa && GEO.metros[c.msa] ? c.msa : null, counties: [c], zips: ZC.filter(z => z.county === id) };
    }
    const firmM = () => { const F = FIRM.get(); const r = FIRM.responsible(), p = FIRM.primary(); const o = P.ov || {}; return { name: (o.name || F.name || '').trim(), atty: (o.atty || r.name || '').trim(), city: (o.city || p.city || '').trim(), phone: phoneFmt(o.phone || F.phone || p.phone || ''), url: (o.url || F.url || '').trim(), street: p.street || '', zip: p.zip || '', hours: p.hours || '', offices: (F.offices || []).map(x => ({ street: x.street, city: x.city, zip: x.zip })), lawyers: (F.attorneys || []).map(a => ({ name: a.name, bar_no: a.bar_no })), consult: F.name ? (F.consult || {}) : {}, fees: F.name ? (F.fees || {}) : {}, payment: F.name ? (F.payment || '') : '', languages: F.languages || ['en'] }; };   // consultation, fee and payment claims only once the firm has filled its profile (the defaults are not the firm's word)
    /* ACCT.rates(line): observed cpc ($), cvr and retain (percents), each null below its threshold; ACCT.applied(): what Accounts' Apply wrote */
    const appliedLines = () => { try { const a = hasACCT() && typeof ACCT.applied === 'function' ? ACCT.applied() : null; return (a && a.lines) || {}; } catch (e) { return {}; } };
    function actualFor(l) { if (!hasACCT()) return null; try { const a = ACCT.rates(l) || {}; const ap = appliedLines()[l] || {}; const ok = v => { v = +v; return v != null && isFinite(v) && v > 0 ? v : null; }; const r = { cpc: ok(a.cpc) || ok(ap.cpc), cvr: ok(a.cvr) || ok(ap.cvr), retain: ok(a.retain) || ok(ap.retain), n: +a.n || +ap.n || 0, since: a.since || ap.since || '' }; return r.cpc || r.cvr || r.retain ? r : null; } catch (e) { return null; } }
    const usesAct = l => P.useAct[l] === true || (P.useAct[l] !== false && !!appliedLines()[l]);
    function model() {
      const g = geoObj(); const A = asmOf(); const firm = firmM();
      const sel = P.counties.filter(f => g.counties.some(c => c.fips === f)); const cset = new Set(sel.length ? sel : g.counties.map(c => c.fips)); const ctys = g.counties.filter(c => cset.has(c.fips));
      const lines = P.lines.filter(l => LINE_META[l]);
      const rows = lines.map(l => { const L = LINE_META[l]; const n = sum(ctys.map(c => L.cnt(c) || 0)); const fee = P.values[l] || L.fee; return { key: l, name: L.name, short: L.short, n, fee }; });
      const tot = sum(rows.map(r => r.n * r.fee)) || 1;
      rows.forEach(r => { r.share0 = P.shares && P.shares[r.key] != null ? P.shares[r.key] : r.n * r.fee / tot * 100; }); const ss = sum(rows.map(r => r.share0)) || 1; rows.forEach(r => { r.share = r.share0 / ss; });
      const mix = P.mix || DESKX.lineMix(rows); const mt = sum(DESKX.PLATS.map(p => mix[p] || 0)) || 1;
      const plat = {}; DESKX.PLATS.forEach(p => plat[p] = { spend: P.budget * (mix[p] || 0) / mt, clicks: 0, leads: 0, ret: 0 });
      const G = A.google, MS = A.microsoft; const zero = new Set();
      rows.forEach(r => {
        const act = usesAct(r.key) ? actualFor(r.key) : null; const R = { cpc: (act && act.cpc) || G.cost, cvr: (act && act.cvr) || G.cvr, retain: (act && act.retain) || G.ret };
        r.cpc = R.cpc; r.cvr = R.cvr; r.retain = R.retain; r.seas = ST.seas[DK_SEAS(r.key)] || null; r.shift = r.key === 'po' ? 0 : 1; r.src = act ? 'actuals' + (act.since ? ' since ' + act.since : '') : 'assumption'; r.cpcMs = MS.cost * R.cpc / (G.cost || 1);
        r.budget = 0; r.clicks = 0; r.leads = 0; r.ret = 0;
        DESKX.PLATS.filter(p => p !== 'linkedin').forEach(p => {
          const sp = plat[p].spend * r.share; if (!sp) return; const a = A[p]; let cpc = a.cost, cvr = a.cvr, ret = a.ret, clicks = 0, leads = 0;
          if (p === 'google') { cpc = R.cpc; cvr = R.cvr; ret = R.retain; } else if (p === 'microsoft') { cpc = r.cpcMs; cvr = a.cvr * R.cvr / (G.cvr || 1); ret = a.ret * R.retain / (G.ret || 1); }
          r.budget += sp; if (!((a.basis === 'CPC' ? cpc : a.cost) > 0)) { zero.add(p); return; }   // a cost of 0 cannot turn spend into clicks; the platform counts nothing and the tiles say n/a
          if (a.basis === 'CPC') { clicks = sp / cpc; leads = clicks * cvr / 100; } else if (a.basis === 'CPM') { clicks = sp / a.cost * 1000 * a.ctr / 100; leads = clicks * cvr / 100; } else { leads = sp / a.cost; clicks = leads; }
          const rt = leads * ret / 100; r.clicks += clicks; r.leads += leads; r.ret += rt; plat[p].clicks += clicks; plat[p].leads += leads; plat[p].ret += rt;
        });
        r.rev = r.ret * r.fee;
      });
      { const a = A.linkedin, sp = plat.linkedin.spend; if (a.cost > 0) { plat.linkedin.clicks = sp / a.cost; plat.linkedin.leads = plat.linkedin.clicks * a.cvr / 100; } else if (sp) zero.add('linkedin'); }
      // markets
      const pool = g.zips.filter(z => cset.has(z.county) && (z.acs ? (z.acs.hh || 0) : 0) >= P.minhh && z.paid && isN(z.paid.eff_pct));
      let zs = []; if (P.scope === 'top') zs = pool.slice().sort((a, b) => b.paid.eff_pct - a.paid.eff_pct).slice(0, P.n); else if (P.scope === 'metro') zs = pool.slice().sort((a, b) => b.paid.eff_pct - a.paid.eff_pct); else if (P.scope === 'picks') zs = P.picks.map(z => ZI[z]).filter(Boolean);
      const expZ = z => sum(rows.map(r => r.share * ((z.alloc || {})[DK_ALLOC(r.key)] || 0))) + 0.1;
      const w = zs.map(z => Math.pow(expZ(z), P.alpha)); const W = sum(w) || 1;
      const act = watchAct(); const LK = Object.keys(LINE_META); const rivalsOf = f => { const a = act && act[f]; if (!a) return act ? 0 : null; const lined = sum(LK.map(k => a[k] || 0)); return sum(lines.map(l => a[l] || 0)) + Math.max(0, (a._all || 0) - lined); };
      const rivalAdj = f => { const n = rivalsOf(f); return P.watchBid && n ? (n >= 5 ? -20 : n >= 2 ? -10 : 0) : 0; };
      const step = z => (P.bids && isN(P.bids[z.zip])) ? P.bids[z.zip] : (z.paid && z.paid.eff_pct >= 80 ? 20 : z.paid && z.paid.eff_pct >= 60 ? 10 : 0) + rivalAdj(z.county);
      const markets = zs.map((z, i) => ({ zip: z.zip, city: z.city || '', county: z.county, county_name: z.county_name || cname(z.county), gt: z.gt || '', eff: z.paid ? z.paid.eff_pct : null, div: (z.alloc || {}).div, offices: z.lawoffices, rivals: rivalsOf(z.county), bid: step(z), spend: (P.budget - plat.linkedin.spend) * w[i] / W, share: w[i] / W }));   // client media (LinkedIn is not spent on ZIPs)
      const counties = ctys.map(c => ({ fips: c.fips, name: c.name, gt: c.gt || '', rivals: rivalsOf(c.fips), bid: rivalAdj(c.fips) }));
      const countyZips = ZC.filter(z => cset.has(z.county)).map(z => z.zip);
      const cities = {}; (markets.length ? markets : g.zips.filter(z => cset.has(z.county)).map(z => ({ city: z.city, div: (z.alloc || {}).div }))).forEach(m => { if (m.city) cities[m.city] = (cities[m.city] || 0) + (m.div || 0); });
      const topCities = Object.keys(cities).sort((a, b) => cities[b] - cities[a]).slice(0, 8);
      const geoMods = topCities.concat(ctys.slice().sort((a, b) => b.pop2025 - a.pop2025).slice(0, 4).map(c => c.name + ' County'));
      const langs = P.es ? ['en', 'es'] : ['en'];
      const lineInfo = {}; lines.forEach(l => lineInfo[l] = { kw: LINE_META[l].kw });
      const scope = P.scope === 'counties' || markets.length ? P.scope : 'counties';   // never export a campaign with no location: no ZIPs means county targets
      const M = { plan: P, geo: { code: g.code, title: g.title, slug: slug(g.title), county: ctys[0] ? ctys[0].name : '', fips0: ctys[0] ? ctys[0].fips : '' }, g, scope, fellBack: scope !== P.scope, markets, counties, countyZips, lines: rows, lineInfo, plat, langs, esShare: P.esShare / 100, firm, start: P.start, end: DESKX.endDate(P.start, P.weeks), geoMods, cities: topCities, serve: ctys.slice(0, 6).map(c => c.name), asm: A, mix, ctys, act: act && Object.keys(act).length ? act : null, watchOn: !!act, zero };
      return M;
    }
    /* LIVE.timing(line, 'YYYY-MM-DD') multiplies the season by the calendar, claims and observed day factors; the desk applies its own season,
       so it keeps every factor but the season part (and shows only those reasons) */
    const liveTiming = () => { if (!P.live || !hasLIVE()) return null; const cache = new Map(); return (line, d, iso) => { const k = line + iso; if (cache.has(k)) return cache.get(k); let t = null; try { const r = LIVE.timing(line, iso); if (r && Array.isArray(r.parts)) { const ps = r.parts.filter(x => x && x.kind !== 'season' && isFinite(+x.f) && +x.f > 0); t = { mult: ps.reduce((a, x) => a * +x.f, 1), reasons: ps.filter(x => Math.abs(+x.f - 1) >= 0.005).map(x => x.label) }; } else if (r && isFinite(+r.mult)) t = { mult: +r.mult, reasons: r.reasons || [] }; } catch (e) { t = null; } cache.set(k, t); return t; }; };
    const flightLines = M => M.lines.map(r => ({ key: r.key, share: r.share, budget: r.budget, seas: ST.seas[DK_SEAS(r.key)] || null, shift: r.key === 'po' ? 0 : 1 }));
    let M = null, CR = null, FLT = null;
    const creative = () => { if (!CR) CR = DESKX.creative(M); return CR; };
    const clientBudget = () => P.budget - M.plat.linkedin.spend;

    // ---------- UI sync ----------
    function syncUI() {
      $r('#dkGeo').value = P.geo; $r('#dkScope').value = P.scope; $r('#dkPicks').value = P.picks.join(', '); $r('#dkN').value = P.n; $r('#dkMin').value = String(P.minhh); $r('#dkAlpha').value = P.alpha; $r('#dkAlphaV').textContent = N(P.alpha, 1);
      $r('#dkBudget').value = P.budget; $r('#dkStart').value = P.start; $r('#dkWeeks').value = P.weeks; $r('#dkSched').value = P.sched; $r('#dkMetaGeo').value = P.metaGeo; $r('#dkRadius').value = P.radius; $r('#dkLiUse').value = P.li; $r('#dkPay').value = P.pay; $r('#dkEsShare').value = P.esShare; $r('#dkEs').checked = P.es; $r('#dkLive').checked = P.live; $r('#dkWatchBid').checked = P.watchBid; $r('#dkWatchBid').disabled = !hasWATCH();
      $$r('#dkLines input').forEach(i => i.checked = P.lines.includes(i.dataset.l));
      const FF = FIRM.get(); const base = { name: FF.name, atty: FIRM.responsible().name, city: FIRM.primary().city, phone: FIRM.phone(), url: FF.url };
      $$r('[data-ov]').forEach(i => { const k = i.dataset.ov; i.value = P.ov[k] || ''; i.placeholder = base[k] ? 'Profile: ' + base[k] : 'Not in the firm profile'; });
      const g = geoObj(); const cs = $r('#dkCounties'); cs.innerHTML = g.counties.map(c => `<option value="${c.fips}"${P.counties.includes(c.fips) ? ' selected' : ''}>${esc(c.name)}</option>`).join(''); cs.disabled = g.counties.length < 2;
      const today = todayISO(); $r('#dkStartHint').textContent = P.start < today ? 'This start is in the past; the flight and the month plan still begin on it.' : `Ends ${fmtDate(DESKX.endDate(P.start, P.weeks))}.`;
    }
    const mixNote = tot => `Total ${N(tot, 0)}%${Math.abs(tot - 100) > 0.5 ? ' (shares are rescaled to 100%)' : ''}. ${P.mix ? 'Your split.' : 'Line default: the budget weighted blend of each line\'s split (grade D).'}`;
    function mixUI() {
      const mix = M.mix; const tot = sum(DESKX.PLATS.map(p => mix[p] || 0)) || 1;
      $r('#dkMix').innerHTML = DESKX.PLATS.map(p => `<div class="m"><label for="dkMx_${p}">${esc(DESKX.PLAB[p])}</label><input type="range" id="dkMx_${p}" min="0" max="80" step="1" value="${mix[p] || 0}" data-p="${p}"><b>${N(mix[p] || 0, 0)}%</b><span class="usd">${$$$(P.budget * (mix[p] || 0) / tot)}</span></div>`).join('');
      $r('#dkMixNote').textContent = mixNote(tot);
      $$r('#dkMix input').forEach(i => i.oninput = () => { const cur = P.mix || Object.assign({}, M.mix); cur[i.dataset.p] = +i.value; P.mix = cur; i.parentElement.querySelector('b').textContent = i.value + '%'; mixRebuild(); });
    }
    function asmUI() {
      const A = asmOf();
      $r('#dkAsm').innerHTML = `<div class="tblwrap"><table class="t"><thead><tr><th>Platform</th><th>Basis</th><th>Cost $</th><th>CTR %</th><th>Lead conv. %</th><th>Lead to retained %</th><th>Min $ a day</th><th>Grade</th><th class="l">Source</th></tr></thead><tbody>${DESKX.PLATS.map(p => { const a = A[p]; const inp = (k, st) => `<input type="number" step="${st}" min="0" data-p="${p}" data-k="${k}" value="${a[k]}" aria-label="${esc(DESKX.PLAB[p])} ${k}" class="dk-num">`; return `<tr><td>${esc(DESKX.PLAB[p])}</td><td>${a.basis}</td><td>${inp('cost', '0.01')}</td><td>${a.basis === 'CPM' ? inp('ctr', '0.1') : '<span class="small">n/a</span>'}</td><td>${a.basis === 'CPL' ? '<span class="small">n/a</span>' : inp('cvr', '0.1')}</td><td>${inp('ret', '1')}</td><td>${inp('min', '1')}</td><td><span class="grade ${a.g}">${a.g}</span></td><td class="l dk-src">${esc(a.src)}</td></tr>`; }).join('')}</tbody></table></div><div class="btnrow"><button type="button" class="btn sm" id="dkAsmReset">Reset to benchmarks</button><span class="small">CPC is per click, CPM per thousand impressions, CPL per lead. The Google row sets every line's search rates unless actuals replace them.</span></div><div id="dkZeroNote"></div>`;
      const setAsm = i => { if (i.value === '' || !isFinite(+i.value)) return false; const A2 = asmOf(); A2[i.dataset.p][i.dataset.k] = Math.max(0, +i.value); P.asm = A2; return true; };
      $$r('#dkAsm input').forEach(i => { const d = debounce(() => { if (setAsm(i)) rebuild(); }, 250); i.oninput = d; i.onchange = () => { if (!setAsm(i)) i.value = asmOf()[i.dataset.p][i.dataset.k]; if (+i.value < 0) i.value = 0; rebuild(); }; });
      $r('#dkAsmReset').onclick = () => { P.asm = null; asmUI(); rebuild(); };
    }

    // ---------- render ----------
    function rebuild(light) {
      const fa = document.activeElement; const fk = fa && root.contains(fa) && fa.tagName === 'INPUT' ? (fa.id ? '#' + fa.id : fa.dataset.l ? `#dkAlloc input[data-l="${fa.dataset.l}"]` : fa.dataset.v ? `#dkAlloc input[data-v="${fa.dataset.v}"]` : '') : '';
      M = model(); CR = null; FLT = DESKX.flightMonths({ start: P.start, weeks: P.weeks, budget: clientBudget(), lines: flightLines(M), timing: liveTiming() }); save();
      if (!light) mixUI(); else { const tot = sum(DESKX.PLATS.map(p => M.mix[p] || 0)) || 1; $$r('#dkMix .m').forEach(row => { const i = row.querySelector('input'); row.querySelector('.usd').textContent = $$$(P.budget * (M.mix[i.dataset.p] || 0) / tot); }); $r('#dkMixNote').textContent = mixNote(tot); }
      firmNote(); tiles(); actuals(); drawMarketMap(); tab(); alloc(); zipTable(); builder(); keys(); kwDesk(); months(); screenPanel(); meas(); liveOut();
      zeroNote(); emitPlan();
      if (fk) { const el2 = $r(fk); if (el2 && el2 !== document.activeElement) { try { el2.focus({ preventScroll: true }); } catch (e) { } } }
    }
    function zeroNote() { const z = [...M.zero]; const h = $r('#dkZeroNote'); if (h) h.innerHTML = z.length ? callout('judg', 'A cost of 0', `<p>${esc(z.map(p => DESKX.PLAB[p]).join(', '))} ${z.length > 1 ? 'have' : 'has'} a cost of 0, which cannot turn spend into clicks or leads, so ${z.length > 1 ? 'they count' : 'it counts'} nothing and the tiles show n/a where a rate cannot be computed. Enter a cost above 0.</p>`) : ''; }
    const mixRebuild = debounce(() => rebuild(true), 120);
    const emitPlan = debounce(() => { try { BUS.emit('plan', self.plan()); } catch (e) { } }, 400);
    function firmNote() {
      const miss = FIRM.missing(); const F = firmM(); const es = P.es && !(F.languages || []).includes('es');
      $r('#dkFirmNote').innerHTML = (miss.length ? callout('judg', 'The firm profile is not complete', `<p>Missing: ${esc(miss.join(', '))}. Ads carry bracketed placeholders until the profile (or the overrides below) fills them, and the compliance engine blocks a placeholder, so those ads export as needs review. <button type="button" class="btn sm" id="dkFirmBtn">Open the firm profile</button></p>`) : '') + (es ? callout('judg', 'Spanish campaigns without Spanish speaking staff in the profile', '<p>A Spanish ad promises a Spanish speaking intake. Tick Spanish speaking staff in the firm profile, or turn Spanish campaigns off (Rule 7.01: no misleading communication about the firm\'s services).</p>') : '');
      const b = $r('#dkFirmBtn'); if (b) b.onclick = () => FIRM.panel();
    }
    function tiles() {
      const g = M.g; const T = { spend: P.budget, clicks: sum(DESKX.PLATS.filter(p => p !== 'linkedin').map(p => M.plat[p].clicks)), leads: sum(DESKX.PLATS.filter(p => p !== 'linkedin').map(p => M.plat[p].leads)), ret: sum(M.lines.map(r => r.ret)), rev: sum(M.lines.map(r => r.rev)), n: sum(M.lines.map(r => r.n)) };
      const objs = countObjects(); const cr = creative(); const nr = cr.filter(a => a.review.block).length;
      const mk = M.scope === 'counties' ? `${M.counties.length} count${M.counties.length === 1 ? 'y' : 'ies'}` : `${M.markets.length} ZIPs`;
      $r('#dkTiles').innerHTML = tile('Geography', esc(g.title), `${M.ctys.length} count${M.ctys.length > 1 ? 'ies' : 'y'} · ${N(g.zips.length)} ZIPs · ${N(sum(M.ctys.map(c => c.pop2025)))} people`)
        + tile('Monthly media', $$$(T.spend), `${P.weeks} weeks from ${fmtDate(P.start)} · ${$$$(T.spend * P.weeks / 4.345)} in the flight`, 'D')
        + tile('Markets bought', esc(mk), M.scope === 'counties' ? 'county targets with criterion IDs' : `${M.markets.filter(m => m.gt).length} with Google criterion IDs`, 'C')
        + tile('Expected matters / yr', N(T.n, 0), 'across the chosen lines (court filings and estimates)')
        + tile('Clicks / month', N(T.clicks, 0), 'search clicks plus social and video clicks', 'D')
        + tile('Leads / month', N(T.leads, 1), 'calls, forms and Local Services leads', 'D')
        + tile('Retained / month', N(T.ret, 1), 'leads times each platform\'s lead to retained rate', 'D')
        + tile('Cost per retained matter', T.ret > 0 ? $$$(clientBudget() / T.ret) : NA, T.leads > 0 ? `${$$$(clientBudget() / T.leads)} per lead` : (P.budget > 0 ? 'no leads at these rates: check a cost or conversion of 0' : 'no budget set'), 'D')
        + tile('Revenue / month', $$$(T.rev), P.budget > 0 ? N(T.rev / P.budget, 1) + '× the budget' : 'no budget set', 'D')
        + tile('Share of market', DK_PCT(T.ret * 12 / Math.max(T.n, 1), 1), 'retained a year against expected matters')
        + tile('Shock index', N(mean(M.ctys.map(c => c.esi)), 0), 'population unweighted average; lead with modification and enforcement where high')
        + tile('Campaign objects', N(objs.total), `${objs.camps} campaigns · ${objs.groups} ad groups or sets · ${objs.ads} ads`)
        + tile('Creative screened', `${N(cr.length)}`, nr ? `${nr} need review before export` : 'no block findings');
    }
    function countObjects() { let camps = 0, groups = 0, ads = 0; const nl = M.lines.length, ng = M.langs.length; DESKX.PLATS.forEach(p => { if (!M.plat[p].spend) return; if (p === 'google' || p === 'microsoft') { camps += nl * ng; groups += nl * ng * 3; ads += nl * ng * 3; } else if (p === 'lsa') camps += 1; else if (p === 'linkedin') { const k = P.li === 'both' ? 2 : 1; camps += k; ads += k; } else if (p === 'meta') { camps += ng; groups += nl * ng; ads += nl * ng; } else if (p === 'yelp' || p === 'nextdoor') { camps += 1; ads += nl; } else { camps += nl * ng; groups += nl * ng; ads += nl * ng; } }); return { camps, groups, ads, total: camps + groups + ads }; }
    function actuals() {
      const host = $r('#dkAct');
      if (!hasACCT()) { host.innerHTML = callout('', 'Actuals: not connected', `<p>The search rates are benchmarks. Once the Accounts module holds what the accounts actually did, the desk offers to replace the assumed CPC, conversion and retained rates line by line and shows the difference.${MODI.accounts ? ' <button type="button" class="btn sm" id="dkGoAcct">Open Accounts</button>' : ''}</p>`); const b = $r('#dkGoAcct'); if (b) b.onclick = () => goModule('accounts'); return; }
      const A = asmOf().google; const rows = M.lines.map(r => ({ r, a: actualFor(r.key) }));
      const d = (x, y, f, upGood) => (isN(x) && isN(y) ? `<span class="${y === x ? '' : (y > x) === !!upGood ? 'dk-dn' : 'dk-up'}">${y >= x ? '+' : '\u2212'}${f(Math.abs(y - x))}</span>` : NA);   // red where the actual is worse than assumed
      host.innerHTML = panel('Actuals against the assumptions', 'From the Accounts module, per line over the last 90 days (each figure needs its minimum: 50 clicks, 3 leads, 10 decided inquiries). Tick a line to plan on its actuals; lines applied in Accounts start ticked. The difference is actual minus assumed.', `<div class="tblwrap"><table class="t"><thead><tr><th>Line</th><th>CPC assumed</th><th>CPC actual</th><th>Diff</th><th>Conv. assumed</th><th>Conv. actual</th><th>Diff</th><th>Retained assumed</th><th>Retained actual</th><th>Diff</th><th>Rows</th><th>Since</th><th>Use</th></tr></thead><tbody>${rows.map(({ r, a }) => `<tr><td>${esc(r.name)}</td><td>${$$$(A.cost, 2)}</td><td>${a && a.cpc ? $$$(a.cpc, 2) : NA}</td><td>${d(A.cost, a && a.cpc, v => $$$(v, 2))}</td><td>${P1(A.cvr, 1)}</td><td>${a && a.cvr ? P1(a.cvr, 1) : NA}</td><td>${d(A.cvr, a && a.cvr, v => N(v, 1) + ' pts', true)}</td><td>${P1(A.ret, 0)}</td><td>${a && a.retain ? P1(a.retain, 1) : NA}</td><td>${d(A.ret, a && a.retain, v => N(v, 1) + ' pts', true)}</td><td>${a ? N(a.n) : NA}</td><td>${a && a.since ? esc(fmtDate(a.since)) : NA}</td><td><label class="chk"><input type="checkbox" data-act="${r.key}"${usesAct(r.key) ? ' checked' : ''}${a ? '' : ' disabled'} aria-label="Use actuals for ${esc(r.name)}"></label></td></tr>`).join('')}</tbody></table></div><div class="btnrow"><button type="button" class="btn sm" id="dkActAll">Use actuals for every line with data</button><button type="button" class="btn sm" id="dkActNone">Back to assumptions</button></div>`);
      $$r('[data-act]').forEach(i => i.onchange = () => { P.useAct[i.dataset.act] = i.checked; rebuild(); });
      $r('#dkActAll').onclick = () => { rows.forEach(({ r, a }) => { if (a) P.useAct[r.key] = true; }); rebuild(); }; $r('#dkActNone').onclick = () => { P.useAct = Object.fromEntries(M.lines.map(r => [r.key, false])); rebuild(); };
    }
    function drawMarketMap() {
      const host = $r('#dkMap'); const g = M.g;
      if (g.metro && GEO.metros[g.metro]) {
        const G = GEO.metros[g.metro]; const inBuy = {}; M.markets.forEach(m => inBuy[m.zip] = m); const cset = new Set(M.ctys.map(c => c.fips)); const mx = Math.max(1e-9, ...M.markets.map(m => m.spend));
        const val = id => { if (M.scope === 'counties') { const z = ZI[id]; return z && cset.has(z.county) ? 1 : null; } return inBuy[id] ? inBuy[id].spend / mx : null; };
        drawMap(host, { W: G.W, H: G.H, paths: G.zcta, value: val, color: v => rampColor('forest', 0.25 + 0.75 * v), label: id => { const z = ZI[id]; const m = inBuy[id]; return `<b>${esc(id)}${z && z.city ? ' · ' + esc(z.city) : ''}</b>${m ? `<div class="row"><span>Monthly allocation</span><span>${$$$(m.spend)}</span></div><div class="row"><span>Bid step</span><span>${DK_BID(m.bid)}</span></div>` : `<div class="row"><span>${M.scope === 'counties' ? 'County target' : 'Not in the buy'}</span><span>${M.scope === 'counties' ? '' : 'click to add'}</span></div>`}${z && z.paid ? `<div class="row"><span>Efficiency</span><span>${N(z.paid.eff_pct, 0)}</span></div>` : ''}`; }, onSelect: id => { if (M.scope === 'counties' || !ZI[id]) return; const cur = new Set(M.markets.map(m => m.zip)); if (cur.has(id)) cur.delete(id); else cur.add(id); P.scope = 'picks'; P.picks = [...cur]; syncUI(); rebuild(); }, counties: G.county, cent: G.ccent, labels: Object.keys(G.county), labelText: id => CI[id] ? CI[id].name : id, legend: { title: M.scope === 'counties' ? 'County target' : 'Monthly allocation', min: M.scope === 'counties' ? '' : $$$(Math.min(...M.markets.map(m => m.spend).concat([mx]))), max: M.scope === 'counties' ? '' : $$$(mx), css: rampCSS('forest') }, noDataLabel: 'not bought' });
        $r('#dkMapSub').textContent = M.scope === 'counties' ? 'Shaded ZIPs fall in the targeted counties.' : 'Shaded by monthly allocation (expected filings to the power α). Click a ZIP to add or drop it; the scope switches to hand picked.';
      } else {
        drawMap(host, { W: GEO.state.W, H: GEO.state.H, paths: GEO.state.county, value: id => M.ctys.some(c => c.fips === id) ? 1 : null, color: () => rampColor('forest', 0.8), label: id => `<b>${esc(cname(id))} County</b>`, outline: GEO.state.outline, noDataLabel: 'not targeted' });
        $r('#dkMapSub').textContent = 'No ZIP geometry outside the metros; the plan targets the county by its criterion ID.';
      }
    }
    function tab() {
      $$r('#dkTabs button').forEach(b => b.classList.toggle('on', b.dataset.v === UI.tab)); const host = $r('#dkTab');
      if (UI.tab === 'platforms') {
        const ps = DESKX.PLATS.filter(p => M.plat[p].spend > 0);
        host.innerHTML = `<div class="tblwrap"><table class="t"><thead><tr><th>Platform</th><th>$/mo</th><th>$/day</th><th>Clicks</th><th>Leads</th><th>Ret.</th><th>$/ret.</th></tr></thead><tbody>${ps.map(p => { const f = M.plat[p]; return `<tr><td>${esc(DESKX.PLAB[p])}</td><td>${$$$(f.spend)}</td><td>${$$$(f.spend / 30.4)}</td><td>${N(f.clicks, 0)}</td><td>${N(f.leads, 1)}${p === 'linkedin' ? '*' : ''}</td><td>${p === 'linkedin' ? NA : N(f.ret, 2)}</td><td>${f.ret > 0 ? $$$(f.spend / f.ret) : NA}</td></tr>`; }).join('')}</tbody></table></div>${ps.includes('linkedin') ? '<p class="small">* LinkedIn leads are applications or partner contacts, not client matters.</p>' : ''}${ps.filter(p => M.plat[p].spend / 30.4 < asmOf()[p].min).map(p => callout('judg', 'Below the daily minimum: ' + DESKX.PLAB[p], `<p>${esc(DESKX.PLAB[p])} gets ${$$$(M.plat[p].spend / 30.4)} a day against the ${$$$(asmOf()[p].min)} floor set above; split across ${M.lines.length} line${M.lines.length > 1 ? 's' : ''} it is thinner still. Fold the lines into one campaign or move the money to Search.</p>`)).join('')}`;
      } else if (UI.tab === 'flight') {
        const tot = sum(FLT.map(x => x.spend)); const live = !!liveTiming();
        host.innerHTML = `<div class="tblwrap"><table class="t"><thead><tr><th>Month</th><th>Days</th><th>Season index</th><th>Live ×</th><th>Media</th></tr></thead><tbody>${FLT.map(x => `<tr><td>${x.label}</td><td>${x.days}</td><td>${N(x.idx, 0)}</td><td>${live ? N(x.mult, 2) : NA}</td><td>${$$$(x.spend)}</td></tr>`).join('')}</tbody></table></div><p class="small">The flight spends ${$$$(tot)} on client platforms over ${P.weeks} weeks from ${esc(fmtDate(P.start))}, each day weighted by its line's statewide filing season one month ahead (the consultation precedes the petition; protective orders are not shifted)${live ? ', times the Live Desk multiplier for that day' : ''}. LinkedIn runs flat.</p>`;
      } else if (UI.tab === 'rivals') {
        if (!M.act) { host.innerHTML = `<p class="small">${M.watchOn ? 'Competitor Watch holds no live rival ads yet. Log the ads you see (Meta Ad Library, Google Ads Transparency Center) and this tab counts them by county; it reflects only what the firm logs.' : 'Competitor Watch is not loaded in this build, so the plan carries no competitor pressure.'}</p>${MODI.watch ? '<div class="btnrow"><button type="button" class="btn sm" id="dkGoWatch">Open Competitor Watch</button></div>' : ''}`; const b0 = $r('#dkGoWatch'); if (b0) b0.onclick = () => goModule('watch'); return; }
        const rows = M.counties.filter(k => k.rivals).sort((a, b) => b.rivals - a.rivals);
        host.innerHTML = `<p class="small">Live rival ads for these lines that the firm has logged in Competitor Watch in the last 120 days, by county. It reflects only what the firm has logged, not the whole auction: a county with none may simply be unwatched.${P.watchBid ? ' Bid steps are lowered 10 points where 2 to 4 rival ads are logged and 20 points at 5 or more (an assumption, grade D: their auctions cost more per lead).' : ' Tick the box in the plan to lower bid steps where rivals are logged.'}</p>${rows.length ? `<div class="tblwrap"><table class="t"><thead><tr><th>County</th><th>Rival ads</th><th>Bid change</th></tr></thead><tbody>${rows.map(k => `<tr><td>${esc(k.name)}</td><td>${N(k.rivals)}</td><td>${P.watchBid ? (k.bid ? '\u2212' + Math.abs(k.bid) + '%' : '0%') : NA}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small">No rival ads logged for these lines in the plan\'s counties.</p>'}${MODI.watch ? '<div class="btnrow"><button type="button" class="btn sm" id="dkGoWatch">Open Competitor Watch</button></div>' : ''}`;
        const b = $r('#dkGoWatch'); if (b) b.onclick = () => goModule('watch');
      } else { const o = countObjects(); host.innerHTML = `<p style="font-size:13.5px">${o.camps} campaigns, ${o.groups} ad groups or ad sets and ${o.ads} ads across ${DESKX.PLATS.filter(p => M.plat[p].spend > 0).length} platforms. Search runs one campaign per line and language with three ad groups (Core in exact and phrase, Questions in phrase, Local with the city and county forms in exact), each with one responsive search ad of up to 15 headlines and 4 descriptions. Meta runs one campaign per language with an ad set per line; Demand Gen and TikTok one campaign per line and language; Yelp and Nextdoor one campaign with an ad per line; Local Services one profile.</p>`; }
    }
    /* editing one line's share pins it and scales the other lines to 100 minus it, so the typed number stays */
    function pinShare(key, v) { v = clamp(+v || 0, 0, 100); const cur = Object.fromEntries(M.lines.map(r => [r.key, r.share * 100])); const others = M.lines.filter(r => r.key !== key); const So = sum(others.map(r => cur[r.key])); const out = {}; out[key] = others.length ? v : 100; others.forEach(r => { out[r.key] = So > 0 ? cur[r.key] * (100 - v) / So : (100 - v) / others.length; }); P.shares = out; }
    function alloc() {
      if (!M.lines.length) { $r('#dkAlloc').innerHTML = '<p class="small">No service line is checked. Pick at least one line in the plan above; until then the desk allocates nothing and the files carry no campaigns.</p>'; return; }
      const th = ['Line', 'Matters/yr', 'Value $', 'Share %', 'Budget/mo', 'CPC', 'Conv.', 'Retained', 'Leads/mo', 'Retained/mo', 'Revenue/mo'];
      $r('#dkAlloc').innerHTML = `<div class="tblwrap"><table class="t dk-alloc"><thead><tr>${th.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${M.lines.map(r => { const c = [esc(r.name), N(r.n, 0), `<input type="number" class="dk-num" data-v="${r.key}" value="${r.fee}" step="500" min="0" aria-label="Value per matter, ${esc(r.name)}">`, `<input type="number" class="dk-num" data-l="${r.key}" value="${(r.share * 100).toFixed(0)}" min="0" max="100" step="1" aria-label="Budget share, ${esc(r.name)}"${M.lines.length < 2 ? ' disabled' : ''}>`, $$$(r.budget), r.cpc > 0 ? $$$(r.cpc, 2) : NA, P1(r.cvr, 1), P1(r.retain, 0) + (r.src !== 'assumption' ? ' <span class="pill p-ok">actual</span>' : ''), N(r.leads, 1), N(r.ret, 2), $$$(r.rev)]; return `<tr>${c.map((x, i) => `<td data-th="${th[i]}"${i === 5 ? ` title="${esc(r.src)}"` : ''}>${x}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div><p class="small">Values default to module 06 (grade D); the search rates are the Google row of the benchmarks unless actuals replace them. Budget per line excludes LinkedIn.${M.lines.some(r => !(r.cpc > 0)) ? ' A CPC of 0 counts no clicks (n/a).' : ''}</p>`;
      $$r('#dkAlloc input[data-l]').forEach(i => { const go = () => { if (i.value === '' || !isFinite(+i.value)) return; pinShare(i.dataset.l, +i.value); rebuild(); }; i.oninput = debounce(go, 300); i.onchange = go; });
      $$r('#dkAlloc input[data-v]').forEach(i => { const go = () => { if (i.value === '') return; const v = +i.value; if (v > 0) P.values[i.dataset.v] = v; else delete P.values[i.dataset.v]; rebuild(); }; i.oninput = debounce(go, 300); i.onchange = go; });
    }
    function zipTable() {
      if (M.scope === 'counties') { $r('#dkZipH').textContent = 'County targets'; $r('#dkZipSub').textContent = `${M.fellBack ? 'No ZIPs in the buy for this scope, so the files target the counties instead. ' : ''}${M.counties.length} counties targeted by Google criterion ID; Meta, Nextdoor and TikTok get the ${N(M.countyZips.length)} ZIPs inside them.`; $r('#dkZips').innerHTML = `<div class="tblwrap" style="max-height:300px"><table class="t"><thead><tr><th>County</th><th>Criterion</th><th>Population</th><th>Divorce filings/yr</th>${M.act ? '<th>Rival ads logged</th><th>Bid</th>' : ''}</tr></thead><tbody>${M.counties.map(k => { const c = CI[k.fips]; return `<tr><td>${esc(c.name)}</td><td>${esc(c.gt || NA)}</td><td>${N(c.pop2025)}</td><td>${N(c.filings.ttm.div)}</td>${M.act ? `<td>${N(k.rivals)}</td><td>${DK_BID(k.bid)}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>`; return; }
      $r('#dkZipH').textContent = 'ZIP targets'; const zs = M.markets; const allDiv = sum(M.g.zips.map(z => (z.alloc || {}).div || 0));
      $r('#dkZipSub').textContent = zs.length ? `${zs.length} ZIPs (${{ top: 'top by efficiency', metro: 'every ZIP in scope', picks: 'hand picked' }[P.scope]}); ${N(sum(zs.map(z => z.div || 0)), 0)} expected divorce filings a year inside them (${DK_PCT(sum(zs.map(z => z.div || 0)) / Math.max(1, allDiv), 0)} of the geography). Efficiency is expected filings per law office in the ZIP, so the top ZIPs often have no local office at all: demand without a competitor next door, not a cheaper auction.` : '';
      $r('#dkZips').innerHTML = zs.length ? `<div class="tblwrap" style="max-height:300px"><table class="t"><thead><tr><th>ZIP</th><th class="l">City</th><th>Eff</th><th>Div/yr</th><th>Offices</th>${M.act ? '<th>Rival ads</th>' : ''}<th>Bid</th><th>$/mo</th><th>Criterion</th></tr></thead><tbody>${zs.map(z => `<tr><td>${z.zip}</td><td class="l">${esc(z.city)}</td><td>${N(z.eff, 0)}</td><td>${N(z.div, 0)}</td><td>${N(z.offices)}${z.offices === 0 ? ' <span class="dk-flag">no local office</span>' : ''}</td>${M.act ? `<td>${N(z.rivals)}</td>` : ''}<td>${DK_BID(z.bid)}</td><td>${$$$(z.spend)}</td><td>${esc(z.gt || 'by name')}</td></tr>`).join('')}</tbody></table></div>` : `<div class="small">${M.g.zips.length ? 'No ZIPs in the buy: pick some, widen the scope or lower the household minimum.' : 'No ZIP geometry outside the metros; switch the scope to counties.'}</div>`;
    }
    // ---------- platform builders ----------
    const cnt = (v, max) => `<span class="cnt${max && v.length > max ? ' over' : ''}">${v.length}${max ? '/' + max : ''}</span>`;
    function findingsHTML(rv) { if (!rv.findings.length) return `<div class="finding ok"><b>Compliance screen: no findings</b></div>`; return rv.findings.map(f => `<div class="finding ${f.sev === 'block' ? 'crit' : f.sev === 'info' ? 'info' : ''}"><b>${sevPill(f.sev)} ${esc(f.title)}</b><span class="rule">${esc(f.rule || '')}</span>${f.hit ? ` <code>${esc(f.hit)}</code>` : ''}${f.why ? `<div class="small">${esc(f.why)}</div>` : ''}</div>`).join(''); }
    function builder() {
      $$r('#dkPTabs button').forEach(b => b.classList.toggle('on', b.dataset.v === UI.plat));
      const ls = M.lines.map(r => r.key); if (!ls.includes(UI.line)) UI.line = ls[0]; $r('#dkBLine').innerHTML = M.lines.map(r => `<option value="${r.key}"${r.key === UI.line ? ' selected' : ''}>${esc(r.name)}</option>`).join('');
      if (!M.langs.includes(UI.lang)) UI.lang = 'en'; $r('#dkBLang').value = UI.lang; $$r('#dkBLang option').forEach(o => o.disabled = !M.langs.includes(o.value));
      const pv = $r('#dkPrev'); pv.innerHTML = M.markets.slice(0, 60).map(m => `<option value="${m.zip}"${m.zip === UI.prev ? ' selected' : ''}>${m.zip} ${esc(m.city)}</option>`).join('') || '<option value="">County targets</option>'; if (!M.markets.some(m => m.zip === UI.prev)) UI.prev = M.markets[0] ? M.markets[0].zip : '';
      const p = UI.plat, B = DESKX.PBOOK[p], line = UI.line, lang = UI.lang; const z = M.markets.find(m => m.zip === UI.prev) || M.markets[0] || null;
      let cr = '';
      if (!line) cr = '<p class="small">Pick at least one service line.</p>';
      else if (p === 'google' || p === 'microsoft') { const r = DESKX.rsa(M, line, z, lang, p); const f = {}; r.h.forEach((h, i) => f['headline' + (i + 1)] = h); r.d.forEach((d, i) => f['description' + (i + 1)] = d); f.path1 = r.path1; f.path2 = r.path2; const rv = DESKX.screen(p, f, lang); const hm = DESKX.limit(p, 'headline'), dm = DESKX.limit(p, 'description');
        cr = `<div class="dk-sec">Responsive search ad, Local ad group</div>${r.h.map(h => `<div class="dk-asset">${cnt(h, hm)}<span>${esc(h)}</span></div>`).join('')}${r.d.map((d, i) => `<div class="dk-asset">${cnt(d, dm)}<span>${esc(d)}${i === 0 && r.pinned ? ' <span class="pill">pinned 1</span>' : ''}</span></div>`).join('')}<div class="small">Display path: /${esc(r.path1)}/${esc(r.path2)}${r.lp ? '. ' + esc('The Rule 7.02(a) line did not fit; the landing page carries it.') : ''}</div>${findingsHTML(rv)}`; }
      else if (p === 'lsa') { const f = DESKX.lsa(M); cr = `<div class="dk-sec">Build sheet</div><div class="tblwrap"><table class="t dk-kv"><tbody>${f.rows.map(r => `<tr><td class="l">${esc(r[0])}</td><td class="l dk-wrap">${esc(r[1])}</td></tr>`).join('')}</tbody></table></div>${findingsHTML(DESKX.screen('lsa', { bio: DESKX.lsaBio(M) }, 'en'))}`; }
      else if (p === 'linkedin') { cr = (P.li === 'both' ? ['recruit', 'referral'] : [P.li]).map(k => { const a = DESKX.recruitAd(M, k); return `<div class="dk-sec">${k === 'referral' ? 'Referral partner ad' : 'Recruiting ad'}</div><div class="dk-asset">${cnt(a.fields.intro, DESKX.limit('linkedin', 'intro'))}<span>${esc(a.fields.intro)}</span></div><div class="dk-asset">${cnt(a.fields.headline, DESKX.limit('linkedin', 'headline'))}<span>${esc(a.fields.headline)}</span></div><div class="small">Job titles: ${esc(a.titles.join(', '))}</div>${findingsHTML(DESKX.screen('linkedin', a.fields, 'en'))}`; }).join(''); }
      else { const s = DESKX.social(M, p, line, lang, z); const rv = DESKX.screen(p, s.fields, lang); const LP = { meta: 'meta', dg: 'dg', yelp: 'yelp', nextdoor: 'nextdoor', tiktok: 'tiktok' }[p];
        cr = `<div class="dk-sec">${p === 'dg' ? 'Demand Gen asset text' : 'Ad copy'}</div>${Object.keys(s.fields).map(k => `<div class="dk-asset">${cnt(String(s.fields[k] || ''), DESKX.limit(LP, k.replace(/\d+$/, '')))}<span><span class="dk-mute">${esc(k)}</span> ${esc(s.fields[k])}</span></div>`).join('')}${s.lp ? '<div class="small">The Rule 7.02(a) line did not fit; the landing page carries it.</div>' : ''}${findingsHTML(rv)}`; }
      const fbtn = FILES.find(f => f[1] === p);
      $r('#dkBuild').innerHTML = `<div class="dk-split"><div><div class="dk-sec">Structure</div><p class="dk-p">${esc(B.bulk)}</p><div class="dk-sec">Targeting</div><p class="dk-p">${esc(B.geo)}</p><div class="dk-sec">Rules that bind this buy</div><ul class="dk-ul">${B.policy.map(x => `<li>${esc(x)}</li>`).join('')}</ul><dl class="kv"><dt>Monthly media on this platform</dt><dd>${$$$(M.plat[p].spend)}</dd><dt>A day</dt><dd>${$$$(M.plat[p].spend / 30.4)}</dd></dl><div class="btnrow"><button type="button" class="btn sm" id="dkBFile">↓ ${esc(fbtn[2])} file</button></div></div><div>${cr}</div></div>`;
      $r('#dkBFile').onclick = () => exportFile(p);
    }
    // ---------- keywords ----------
    function keys() {
      $r('#dkKeys').innerHTML = (M.lines.length ? `<p class="small"><b>Local modifiers for every line:</b> ${M.geoMods.map(m => esc(m)).join(', ') || NA}</p>` : '') + M.lines.map(r => { const L = LINE_META[r.key]; const kws = DESKX.keywords(M, r.key, 'en'); const rs = DESKX.rsa(M, r.key, M.markets[0] || null, 'en'); return `<div class="dk-line"><b>${esc(L.name)}</b> <span class="small">${kws.length} keywords${M.langs.includes('es') ? ` plus ${DESKX.keywords(M, r.key, 'es').length} in Spanish` : ''} · seeds: ${L.kw.map(k => `<code>${esc(k)}</code>`).join(' ')}</span><div class="dk-pills">${rs.h.slice(0, 5).map(h => `<span class="pill">${esc(h)}</span>`).join('')}<span class="pill">${esc(rs.d[0] || '')}</span></div><div class="small" style="margin-top:4px">${esc(L.angle)}</div></div>`; }).join('') || '<p class="small">Pick at least one service line.</p>';
    }
    function kwDesk() {
      const ls = M.lines.map(r => r.key); if (!ls.includes(UI.kwLine)) UI.kwLine = ls[0]; $r('#dkKwLine').innerHTML = M.lines.map(r => `<option value="${r.key}"${r.key === UI.kwLine ? ' selected' : ''}>${esc(r.name)}</option>`).join('');
      if (!M.langs.includes(UI.kwLang)) UI.kwLang = 'en'; $r('#dkKwLang').value = UI.kwLang; $$r('#dkKwLang option').forEach(o => o.disabled = !M.langs.includes(o.value));
      if (!UI.kwLine) { $r('#dkKwOut').innerHTML = ''; return; }
      const kws = DESKX.keywords(M, UI.kwLine, UI.kwLang); const neg = DESKX.NEG.concat(UI.kwLang === 'es' ? DESKX.NEG_ES : []);
      const fmt = k => k.match === 'Exact' ? `[${k.kw}]` : `"${k.kw}"`;
      $r('#dkKwOut').innerHTML = ['Core', 'Questions', 'Local'].map(gn => { const ks = kws.filter(k => k.group === gn); return ks.length ? `<div class="dk-sec">${gn} · ${ks.length}</div><div class="dk-kw">${ks.map(k => `<div>${esc(fmt(k))} <span class="dk-mute">${k.match.toLowerCase()}</span></div>`).join('')}</div>` : ''; }).join('') + `<div class="dk-sec">Negatives, campaign level · ${neg.length}</div><div class="dk-neg">${neg.map(n => `<code>${esc(n)}</code>`).join(' ')}</div><div class="btnrow"><button type="button" class="btn sm" id="dkKwCopy">Copy keywords</button><button type="button" class="btn sm" id="dkNegCopy">Copy negatives</button></div>`;
      $r('#dkKwCopy').onclick = () => copyText(kws.map(fmt).join('\n')); $r('#dkNegCopy').onclick = () => copyText(neg.join('\n'));
    }
    function months() {
      if (!M.lines.length) { $r('#dkMonthsSub').textContent = 'Pick at least one service line to plan the months.'; $r('#dkMonths').innerHTML = ''; return; }
      const mp = DESKX.monthPlan({ start: P.start, lines: flightLines(M) }); const yr = sum(mp.map(x => x.spend)) || 1;
      $r('#dkMonthsSub').textContent = `Client media by month for the year from ${MOL[mp[0].m]} ${mp[0].y} (the flight start month), weighted by each line's filing season one month ahead (module 09); protective orders follow their own month. LinkedIn is not in it.`;
      $r('#dkMonths').innerHTML = `<div class="cal">${mp.map(r => `<div><span class="small">${r.label}</span><b>${$$$(r.spend)}</b><span class="small">${DK_PCT(r.spend / yr, 1)} of year</span></div>`).join('')}</div>`;
    }
    // ---------- screen all creative ----------
    function screenPanel(show) {
      const cr = creative(); const nr = cr.filter(a => a.review.block); const wf = cr.filter(a => a.review.findings.some(f => f.sev !== 'info'));
      $r('#dkScrSum').textContent = `${N(cr.length)} ads across ${new Set(cr.map(a => a.platform)).size} platforms and ${M.langs.length} language${M.langs.length > 1 ? 's' : ''}: ${nr.length} need review, ${wf.length - nr.length} more with findings to read, ${cr.length - wf.length} clear.`;
      const list = UI.scr === 'issues' ? nr : UI.scr === 'findings' ? wf : cr;
      $r('#dkScrOut').innerHTML = list.length ? '<div class="dk-scr">' + list.slice(0, 120).map(a => `<div class="dk-ad"><div class="dk-adh">${sevPill(a.review.block ? 'block' : a.review.findings.some(f => f.sev === 'warn' || f.sev === 'fix') ? 'warn' : 'ok')} <b>${esc(a.label)}</b> <span class="dk-mute">${a.lang === 'es' ? 'Spanish' : 'English'}</span></div><div class="small dk-wrap">${esc(Object.values(a.fields).filter(Boolean).join(' | '))}</div>${a.review.findings.filter(f => UI.scr === 'all' || f.sev !== 'info' || f.note).map(f => `<div class="small">${sevPill(f.sev)} ${esc(f.title)}${f.rule ? ' · ' + esc(f.rule) : ''}${f.hit ? ` · <code>${esc(f.hit)}</code>` : ''}</div>`).join('')}</div>`).join('') + '</div>' + (list.length > 120 ? `<p class="small">Showing 120 of ${list.length}; the findings CSV has all of them.</p>` : '') : `<p class="small">${UI.scr === 'issues' ? 'No ad needs review: no block findings.' : 'No findings.'}</p>`;
    }
    // ---------- measurement, live, compliance, method ----------
    function meas() {
      const ret = sum(M.lines.map(r => r.ret)); const cpr = clientBudget() / Math.max(1e-9, ret);
      $r('#dkMeas').innerHTML = `<dl class="kv dk-kv2"><dt>Conversion actions</dt><dd>Calls from ads of 60 seconds or more; calls to the website number; consultation form submits on the thank you page; Local Services leads; retained matters imported weekly from the practice management or intake system (Clio Grow, Lawmatics or a sheet) as offline conversions with the matter value.</dd><dt>Naming</dt><dd><code>${esc(M.geo.code)}_{LINE}_{PLATFORM}_{LANG}_${esc(String(P.start).replace(/-/g, ''))}</code>; the line key in every name lets the Accounts module tag the actuals.</dd><dt>UTM</dt><dd><code>utm_source={platform}&amp;utm_medium=cpc&amp;utm_campaign={campaign}&amp;utm_content={line}</code></dd><dt>Target cost per retained matter</dt><dd>${$$$(cpr)} at the current assumptions. Pause an ad group after 40 clicks with no lead, or when the cost per retained matter runs above ${$$$(cpr * 2)} for 30 days; family law leads take weeks to retain, so judge on 60 to 90 days.</dd><dt>Bid steps</dt><dd>Efficiency 80 and up +20%, 60 to 79 +10%, the rest 0% (module 07). After 60 to 90 days replace them with observed cost per retained matter by ZIP.</dd><dt>Calendar rules</dt><dd>Lift divorce and custody budgets into the March filing peak and the August school start; protective order spend follows its own summer peak and is never cut for the season.</dd><dt>Audiences</dt><dd>No remarketing, customer match or life event audiences on divorce or family difficulties (Google personal hardships policy, Meta personal attributes policy).</dd></dl>`;
    }
    function liveOut() {
      const host = $r('#dkLiveOut');
      if (!hasLIVE()) { host.innerHTML = `<p class="small">The Live Desk is not loaded in this build, so the flight follows the statewide seasons only.${MODI.live ? ' Open the Live Desk to see its triggers.' : ''}</p>`; return; }
      if (!P.live) { host.innerHTML = '<p class="small">Live timing is off for this plan (tick the box in the plan to weight the flight by it).</p>'; return; }
      const reasons = {}; FLT.forEach(x => x.reasons.forEach(r => { reasons[r.text] = (reasons[r.text] || 0) + r.days; }));
      const top = Object.keys(reasons).sort((a, b) => reasons[b] - reasons[a]).slice(0, 12);
      host.innerHTML = `<div class="tblwrap"><table class="t"><thead><tr><th>Month</th><th>Live ×</th><th class="l">Why</th></tr></thead><tbody>${FLT.map(x => `<tr><td>${x.label}</td><td>${N(x.mult, 2)}</td><td class="l dk-wrap">${esc(x.reasons.slice(0, 3).map(r => r.text).join('; ') || 'No live trigger')}</td></tr>`).join('')}</tbody></table></div>${top.length ? `<div class="dk-sec">Reasons in the flight</div><ul class="dk-ul">${top.map(t => `<li>${esc(t)} <span class="dk-mute">(${N(reasons[t])} line days)</span></li>`).join('')}</ul>` : '<p class="small">No live trigger falls in the flight.</p>'}`;
    }
    function comp() {
      const rules = (typeof LINT !== 'undefined' && LINT.RULES) || [];
      $r('#dkComp').innerHTML = `<div class="tblwrap" style="max-height:360px"><table class="t"><thead><tr><th>Rule</th><th class="l">Cite</th><th class="l">Why it binds</th></tr></thead><tbody>${rules.map(r => `<tr><td>${sevPill(r.sev)} ${esc(r.t || r.title || '')}</td><td class="l dk-wrap">${esc(r.rule || '')}</td><td class="l dk-wrap">${esc(r.why || '')}</td></tr>`).join('')}<tr><td>${sevPill('warn')} Responsible lawyer and primary practice location</td><td class="l">Rule 7.02(a)</td><td class="l dk-wrap">Every ad names a lawyer responsible for its content and the primary practice location. The desk pins it to description 1 of every search ad and appends it to social copy; where a platform has no room, the export notes that the landing page carries it.</td></tr><tr><td>${sevPill('warn')} Filing</td><td class="l">Rule 7.04</td><td class="l dk-wrap">File a copy of each non exempt ad with the Advertising Review Committee within ten days of first dissemination.</td></tr></tbody></table></div>`;
    }
    function how() {
      $r('#dkHow').innerHTML = [`<b>Lines</b>. Expected matters a year come from the county filings (module 02) and the estimated lines (module 06) for the counties in scope; each line's share of the budget is matters times value per matter, normalized, unless you set it.`, `<b>Markets</b>. ZIPs come from module 07 ranked by efficiency (or every ZIP, or your picks), filtered by households; each ZIP's share is its expected filings for the chosen lines to the power α. The county scope targets counties by criterion ID instead.`, `<b>Platforms</b>. The split defaults to the budget weighted blend of each line's split; CPC platforms turn spend into clicks at the cost per click, CPM platforms by impressions and click through rate, Local Services by cost per lead. Leads times each platform's lead to retained rate give retained matters; times value, revenue.`, `<b>Actuals</b>. When the Accounts module holds results, a line can plan on its own CPC, conversion and retained rates instead of the benchmarks.`, `<b>Pacing</b>. The flight starts on the chosen date and spreads the money day by day by each line's statewide filing season one month ahead, times the Live Desk multiplier when present; the month plan covers the twelve months from the flight start month.`, `<b>Creative</b>. Every asset is filled from the line library with the firm, the office city, the market city and county, cut to the platform's limits, cleaned of hyphens and dashes, given the Rule 7.02(a) line where it fits and screened by the compliance engine.`, `<b>Exports</b>. One file per platform in the format its bulk tool or build sheet takes, every campaign and ad paused; an ad with a block finding is labeled needs review with the findings in the notes column.`].map(x => `<li>${x}</li>`).join('');
      $r('#dkJudg').innerHTML = [['Market cities say "Serving", never "Office in"', 'A headline that names a city where the firm has no office can imply an office there (Rule 7.01). Only the primary office city appears as an office.'], ['The Rule 7.02(a) line is automatic', 'The desk pins the responsible lawyer and the primary office to description 1 of every search ad rather than trusting the rotation, and appends them to social copy where they fit.'], ['No audiences on family difficulties', 'Google treats marital and family difficulties as a personal hardship; Meta forbids implying personal attributes. The desk targets by place and keyword only and exports no remarketing lists.'], ['No outcome or specialty claims', 'The library avoids superlatives, guarantees and "expert" or "specialist"; Board certification appears only in the exact form the Texas Board of Legal Specialization allows.'], ['Spanish is additive', 'Spanish campaigns run alongside English ones, at the share you set, and only make sense when the firm has Spanish speaking staff.'], ['Benchmarks are national', 'The CPC and conversion defaults are national legal medians; Texas metro auctions for divorce terms often run higher. Replace them with actuals after 60 to 90 days.'], ['Values are module 06 defaults', 'Value per matter is a planning figure, not a fee quote; set your own per line.'], ['LinkedIn is not client advertising', 'It funds attorney and paralegal recruiting and referral partner campaigns; its leads are applications and contacts.'], ['Paused exports', 'Every exported campaign and ad is paused so nothing spends before a lawyer reviews it and the filing is made.']].map(([t, d]) => `<div class="dk-j"><b>${esc(t)}</b><div class="small">${esc(d)}</div></div>`).join('');
    }
    // ---------- exports ----------
    const needLines = () => { if (M.lines.length) return true; toast('Pick at least one service line first'); return false; };
    function exportFile(p) { if (!needLines()) return; const f = DESKX[p](M); saveFile(f.name, f.text); }
    function allFiles() {
      const files = DESKX.PLATS.map(p => DESKX[p](M)).concat([DESKX.planCSV(M), DESKX.kwCSV(M), DESKX.zipCSV(M), DESKX.creativeCSV(M), DESKX.flightCSV(M, FLT)]).map(f => ({ name: f.name, data: f.text }));
      files.push({ name: DESKX.fname(M, 'negatives', 'txt'), data: DESKX.negText(M) }, { name: DESKX.fname(M, 'plan', 'json'), data: planJSON() }, { name: 'README.txt', data: readme() });
      return files;
    }
    const planJSON = () => JSON.stringify({ severance_desk: 2, saved: todayISO(), plan: P }, null, 1);
    const readme = () => [`Severance Campaign Desk export, ${fmtDate(todayISO())}`, `Geography: ${M.geo.title}. Flight: ${fmtDate(P.start)} to ${fmtDate(M.end)}, ${P.weeks} weeks. Monthly media: ${$$$(P.budget)}.`, '', ...FILES.map(f => `${DESKX.PLAB[f[1]]}: ${DESKX.PBOOK[f[1]].bulk}`), '', 'Every campaign, ad set and ad is paused. Ads with a block finding carry the label "needs review" and the findings in the Review notes column.', 'Rule 7.04: file non exempt ads with the State Bar of Texas Advertising Review Committee within ten days of first dissemination.'].join('\n');
    function findingsCSV() { const rows = []; creative().forEach(a => (a.review.findings.length ? a.review.findings : [{ sev: '', title: '', rule: '', hit: '' }]).forEach(f => rows.push([DESKX.PLAB[a.platform], a.line, a.lang, a.label, a.review.status, f.sev, f.title, f.rule, f.hit || '']))); return DESKX.csv(['platform', 'line', 'language', 'ad', 'status', 'severity', 'finding', 'rule', 'hit'], rows); }
    FILES.forEach(f => { $r('#' + f[0]).onclick = () => exportFile(f[1]); });
    $r('#dkAll').onclick = () => { if (needLines()) saveFile(DESKX.fname(M, 'all-files', 'zip'), zipBlob(allFiles())); };
    $r('#dkPlanX').onclick = () => { if (!needLines()) return; const f = DESKX.planCSV(M); saveFile(f.name, f.text); };
    $r('#dkKw').onclick = () => { if (!needLines()) return; const f = DESKX.kwCSV(M); saveFile(f.name, f.text); };
    $r('#dkNeg').onclick = () => saveFile(DESKX.fname(M, 'negatives', 'txt'), DESKX.negText(M));
    $r('#dkZip').onclick = () => { const f = DESKX.zipCSV(M); saveFile(f.name, f.text); };
    $r('#dkFl').onclick = () => { const f = DESKX.flightCSV(M, FLT); saveFile(f.name, f.text); };
    $r('#dkCr').onclick = () => { if (!needLines()) return; const f = DESKX.creativeCSV(M); saveFile(f.name, f.text); };
    $r('#dkScrCsv').onclick = () => saveFile(DESKX.fname(M, 'creative-findings', 'csv'), findingsCSV());
    $r('#dkSave').onclick = () => saveFile(DESKX.fname(M, 'plan', 'json'), planJSON());
    $r('#dkLoad').onclick = async () => { const [file] = await pickFiles('.json,application/json'); if (!file) return; try { const j = JSON.parse(await readText(file)); const o = j && (j.plan || j); if (!o || typeof o !== 'object' || !(o.geo || o.lines || o.budget)) throw new Error('not a plan'); P = dkSanitize(o); syncUI(); asmUI(); rebuild(); toast('Plan loaded'); } catch (e) { toast('That file is not a desk plan'); } };

    // ---------- wiring ----------
    const num = (id, k, a, b) => { const i = $r('#' + id); i.oninput = debounce(() => { const v = +i.value; if (i.value !== '' && isFinite(v)) { P[k] = clamp(v, a, b); rebuild(); } }, 300); i.onchange = () => { const v = +i.value; if (i.value !== '' && isFinite(v)) P[k] = clamp(v, a, b); i.value = P[k]; rebuild(); }; };
    $r('#dkGeo').onchange = e => { P.geo = e.target.value; P.counties = []; P.shares = null; if (P.scope === 'picks') P.scope = 'top'; syncUI(); rebuild(); };
    $r('#dkScope').onchange = e => { P.scope = e.target.value; rebuild(); };
    $r('#dkCounties').onchange = e => { P.counties = [...e.target.selectedOptions].map(o => o.value); P.shares = null; rebuild(); };
    $r('#dkPicks').onchange = e => { P.picks = [...new Set(e.target.value.split(/[\s,;]+/).filter(z => ZI[z]))]; if (P.picks.length) P.scope = 'picks'; syncUI(); rebuild(); };
    num('dkN', 'n', 1, 300); num('dkBudget', 'budget', 0, 10000000); num('dkWeeks', 'weeks', 1, 52); num('dkRadius', 'radius', 1, 50); num('dkEsShare', 'esShare', 5, 60);
    $r('#dkMin').onchange = e => { P.minhh = +e.target.value || 0; rebuild(); };
    $r('#dkAlpha').oninput = e => { P.alpha = +e.target.value; $r('#dkAlphaV').textContent = N(P.alpha, 1); }; $r('#dkAlpha').onchange = () => rebuild();
    $r('#dkStart').onchange = e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) P.start = e.target.value; else e.target.value = P.start; syncUI(); rebuild(); };
    [['dkSched', 'sched'], ['dkMetaGeo', 'metaGeo'], ['dkLiUse', 'li']].forEach(([id, k]) => $r('#' + id).onchange = e => { P[k] = e.target.value; rebuild(); });
    { const i = $r('#dkPay'); const go = () => { P.pay = i.value.slice(0, 80); rebuild(); }; i.oninput = debounce(go, 400); i.onchange = go; }
    $r('#dkEs').onchange = e => { P.es = e.target.checked; rebuild(); };
    $r('#dkLive').onchange = e => { P.live = e.target.checked; rebuild(); };
    $r('#dkWatchBid').onchange = e => { P.watchBid = e.target.checked; rebuild(); };
    $$r('#dkLines input').forEach(i => i.onchange = () => { P.lines = $$r('#dkLines input').filter(x => x.checked).map(x => x.dataset.l); P.shares = null; rebuild(); });
    $$r('[data-ov]').forEach(i => { const go = () => { P.ov[i.dataset.ov] = i.value.trim().slice(0, 120); rebuild(); }; i.oninput = debounce(go, 400); i.onchange = go; });
    $r('#dkMixReset').onclick = () => { P.mix = null; rebuild(); };
    $$r('#dkTabs button').forEach(b => b.onclick = () => { UI.tab = b.dataset.v; tab(); });
    $$r('#dkPTabs button').forEach(b => b.onclick = () => { UI.plat = b.dataset.v; builder(); });
    $r('#dkBLine').onchange = e => { UI.line = e.target.value; builder(); }; $r('#dkBLang').onchange = e => { UI.lang = e.target.value; builder(); }; $r('#dkPrev').onchange = e => { UI.prev = e.target.value; builder(); };
    $r('#dkKwLine').onchange = e => { UI.kwLine = e.target.value; kwDesk(); }; $r('#dkKwLang').onchange = e => { UI.kwLang = e.target.value; kwDesk(); };
    $r('#dkScreen').onclick = () => { CR = null; screenPanel(true); toast('Screened ' + creative().length + ' ads'); };
    wireSeg($r('#dkScrSeg'), v => { UI.scr = v; screenPanel(true); });
    /* other modules hand over ZIPs, a line, bid steps or a geography: goModule('desk', {zips, line, lines, bids, geo, counties}) */
    this.receive = p => { if (!p || typeof p !== 'object') return; const o = Object.assign({}, P); if (p.geo) o.geo = p.geo; if (Array.isArray(p.counties)) o.counties = p.counties; if (Array.isArray(p.zips) && p.zips.length) { o.scope = 'picks'; o.picks = p.zips; o.bids = p.bids || null; } if (p.line && LINE_META[p.line]) o.lines = [p.line]; if (Array.isArray(p.lines) && p.lines.length) o.lines = p.lines; P = dkSanitize(o); syncUI(); rebuild(); toast(p.zips && p.zips.length ? `${P.picks.length} ZIPs received` : 'Plan updated'); };
    this.plan = () => ({ inputs: JSON.parse(JSON.stringify(P)), geo: M.geo, start: P.start, end: M.end, weeks: P.weeks, budget: P.budget, cpc: M.asm.google.cost, cvr: M.asm.google.cvr, retain: M.asm.google.ret, lines: M.lines.map(r => ({ key: r.key, share: r.share, budget: r.budget, cpc: r.cpc, cvr: r.cvr, retain: r.retain, src: r.src })), mix: M.mix, zips: M.markets.map(m => m.zip), counties: M.counties.map(c => c.fips), flight: FLT });
    this.feed = () => creative().map(a => ({ label: a.label + (a.lang === 'es' ? ' · Spanish' : ''), text: Object.values(a.fields).filter(Boolean).join('\n'), platform: a.platform, kind: 'ad', lang: a.lang, line: a.line, review: a.review }));
    if (!this._bus) { this._bus = true; ['firm', 'actuals', 'live', 'watch'].forEach(ev => BUS.on(ev, () => { if (self.mounted && self._render) self._render(); })); }
    this._render = () => { syncUI(); rebuild(); };
    syncUI(); asmUI(); comp(); how(); rebuild();
  }
});
