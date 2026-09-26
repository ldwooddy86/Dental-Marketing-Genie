/* ==== m10_satchel ==== */
"use strict";
/* ============================ Module 10: Emergency Satchel ============================ */
const LICX = (() => { const L = DATA.lic || { rows: [], counties: [] }; const m = new Map(); L.rows.forEach(r => m.set(r[0], r)); return { map: m, rows: L.rows, counties: L.counties, asof: L.asof, src: L.src }; })();
const SAT_EXTRA = [
  { id: 'LICOK', fam: 'TDLR', sev: 'note', name: 'Advertised license number matches an active contractor license', cite: 'TDLR license file (open data), A/C Contractor', v: '✔' },
  { id: 'LICSOON', fam: 'TDLR', sev: 'warn', name: 'License renewal due within 90 days', cite: 'Occupations Code ch. 1302; 16 TAC ch. 75 (renewal)', v: '◐', fix: 'Renew before the expiration date; ads and trucks cannot carry an expired number.' },
  { id: 'LICEXP', fam: 'TDLR', sev: 'block', name: 'Advertised license number is expired in the TDLR file', cite: 'Occupations Code §1302.251 (license required); 16 TAC §75.71(h)', v: '◐', fix: 'Confirm on the live TDLR search today; stop advertising the number until it is renewed.' },
  { id: 'LICCLASS', fam: 'TDLR', sev: 'warn', name: 'Advertised license class letter does not match the file', cite: 'TDLR license file; 16 TAC §75.71(h)', v: '◐', fix: 'Print the number exactly as issued (TACLA for Class A, TACLB for Class B).' },
  { id: 'LICNONE', fam: 'TDLR', sev: 'note', name: 'License number not in the DFW extract', cite: 'TDLR license file, 12 county extract', v: '✔', fix: 'Search the live TDLR license search; apply the six way null result taxonomy before calling it unlicensed.' },
  { id: 'LICNAME', fam: 'TDLR', sev: 'note', name: 'Licensed business name differs from the advertised brand', cite: 'TDLR license file', v: '✔', fix: 'Common for assumed names; confirm the brand is registered to the licensee.' },
  { id: 'VEH1', fam: 'TDLR', sev: 'warn', name: 'Company name and license number on both sides of every service vehicle', cite: '16 TAC §75.71', v: '✔', obs: false, fix: 'Photograph each truck; decals must show the business name and license number on both sides.' },
  { id: 'PAPER1', fam: 'TDLR', sev: 'warn', name: 'TDLR consumer notice on proposals, invoices and contracts', cite: '16 TAC §75.71(i)', v: '✔', obs: false, fix: 'Print the regulated by notice with TDLR\'s address and phone on every proposal, invoice and contract.' },
  { id: 'PERMIT1', fam: 'City', sev: 'warn', name: 'Mechanical permit pulled for each changeout', cite: 'City mechanical codes (International Mechanical Code as adopted)', v: '◐', obs: false, fix: 'Pull the permit before the install and give the homeowner the number; the atlas measures about one permit per five modeled replacements in Dallas, Fort Worth and Irving.' },
  { id: 'EPA608', fam: 'EPA', sev: 'warn', name: 'Refrigerant recovered by Section 608 certified technicians, never vented', cite: '40 CFR Part 82, Subpart F', v: '◐', obs: false, fix: 'Keep 608 cards on file and recovery records for each job.' },
];
registerModule({
  key: 'satchel', num: '10', title: 'Emergency Satchel', desc: 'Ads, pages and license claims screened against TDLR, FTC, Texas and platform rules',
  mount(root) {
    const ST = { posture: 'self', target: BRAND.name || (BENCH ? BENCH.name : ''), domain: BRAND.domain || (BENCH ? BENCH.domain : ''), lic: BRAND.lic || 'TACLA12345C', question: 'safe', plats: PLATS.slice(), surf: { ads: true, web: true, fleet: true, paper: true }, cities: [] };
    let FIND = [], SEL = null, CTRL = {}, OVR = {}, LAST = { src: '', label: '' }, FDISP = '', FFAM = '';
    const CTRL_EXTRA = { licVerified: ['LICEXP', 'LICCLASS', 'LICNONE'] };
    const DISPS = ['CONFIRMED', 'CANDIDATE', 'CLEARED', 'NOT_OBSERVABLE', 'INTEL'];
    const DCLS = { CONFIRMED: 'c', CANDIDATE: 'k', CLEARED: 'x', NOT_OBSERVABLE: 'n', INTEL: 'n' };
    const ALLR = SAT.rules.concat(SAT.web.map(w => Object.assign({ fam: 'Web' }, w))).concat(SAT_EXTRA);
    const RULE = {}; ALLR.forEach(r => RULE[r.id] = r);
    const today = new Date('2026-09-25T12:00:00');
    const ymdN = d => +d.toISOString().slice(0, 10).replace(/-/g, '');
    const fmtE = e => { const s = String(e); return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); };
    const strip = h => String(h || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ').trim();
    const sentences = t => String(t || '').replace(/([.!?])\s+/g, '$1\n').split(/\n+/).map(s => s.trim()).filter(s => s.length > 3);
    const glyph = v => v === '✔' ? '<span title="primary text read this build">✔</span>' : '<span title="memory or a secondary source: fetch the live text before it appears in a confirmed finding">◐</span>';
    const SUBCLS = s => (s || '')[0] === 'A' ? 'A' : (s || '')[0] === 'B' ? 'B' : '';

    root.innerHTML = mastHTML({ eyebrow: 'Module 10 · Emergency Satchel', title: 'Emergency Satchel', dek: 'Every surface a DFW heating and cooling contractor shows the public, its ads, its pages, its license number and the trucks and paper that carry it, screened against the rules that get ads rejected, licenses disciplined and deceptive practice claims filed: TDLR\'s advertising rule, the FTC\'s guides and review rule, Regulation Z, the TCPA and Texas SB 140, the Texas DTPA, the insurance code on adjusting claims, the refrigerant and efficiency rules, and each ad platform\'s policies. Findings are sorted by who enforces them and how far they can be proven from here.',
      meta: [`<b>${SAT.rules.length}</b> copy rules · <b>${SAT.web.length}</b> web tests`, `<b>${N(LICX.rows.length)}</b> DFW contractor licenses for lookup`, 'Dispositions: CONFIRMED · CANDIDATE · CLEARED · NOT OBSERVABLE · INTEL', `Rule pack ${SAT.version}`],
      bar: 'Emergency Satchel', barsub: 'Screen, gate, route', actions: [['s10X', '↓ Findings (CSV)'], ['s10Md', '↓ Screen report (MD)'], ['s10Book', '↓ Statute book (CSV)']].map(([id, label]) => ({ id, label })) }) +
      `<div class="wrap">
      ${callout('judg', 'Read this before you run it once', `Using this module to mass report competitors will get your own accounts actioned. Every platform scores reporter reputation, and bad faith reporting is itself a policy violation. The Satchel is built to produce a small number of findings strong enough to survive review, and to keep everything else in house as intelligence. If a run yields forty candidates and three confirmed findings, you file three, and the rest become the competitive picture. A statutory accusation attaches to a named licensee; an overstated finding is a false accusation with your name on it. In self audit posture the same findings become a fix list with an owner for each.`)}
      <div class="card mt"><div class="card-h"><h3>Stage 0 · Posture, target and the question</h3><p>Pin these before a test runs. Posture decides the deliverable; the question decides what done looks like. Never blend postures in one workbook.</p></div><div class="card-b"><div class="plan">
        <div class="f"><label class="fl">Posture</label><div class="seg" id="s10Pos"><button data-v="self" aria-pressed="true">Self audit</button><button data-v="comp" aria-pressed="false">Competitor</button></div><span class="hint">Self audit adds the house style rules and writes fixes; competitor posture writes routes and the evidence bar.</span></div>
        <div class="f"><label class="fl" for="s10Target">Target business</label><input type="text" id="s10Target"></div>
        <div class="f"><label class="fl" for="s10Domain">Domain</label><input type="text" id="s10Domain" placeholder="example.com"></div>
        <div class="f"><label class="fl" for="s10Lic">License number it should carry</label><input type="text" id="s10Lic" placeholder="TACLA12345E"><span class="hint">Checked against the TDLR file below.</span></div>
        <div class="f"><label class="fl" for="s10Q">The question</label><select id="s10Q"><option value="safe">Is it safe to run as is?</option><option value="report">Is there a violation worth reporting?</option><option value="file">What belongs in the compliance file?</option></select></div>
        <div class="f wide"><label class="fl">Platforms in scope (Campaign Desk feed)</label><div class="chips" id="s10Plats">${PLATS.map(p => `<button class="chip" data-v="${p}" aria-pressed="true">${esc(PLAB[p])}</button>`).join('')}</div></div>
        <div class="f wide"><label class="fl">Surfaces</label><div class="chips"><label class="chk"><input type="checkbox" id="s10sAds" checked> Ads and ad copy</label><label class="chk"><input type="checkbox" id="s10sWeb" checked> Website pages</label><label class="chk"><input type="checkbox" id="s10sFleet" checked> Trucks and signage (not observable here)</label><label class="chk"><input type="checkbox" id="s10sPaper" checked> Proposals, invoices, permits and refrigerant records (not observable here)</label></div></div>
      </div></div></div>

      <div class="card mt"><div class="card-h"><h3>Stages 1 to 4 · Sources and batteries</h3><p>Paste a page's raw HTML or its text (view source keeps the scripts and schema that the web tests need), or pull this atlas's own output: every ad the Campaign Desk wrote, or every page the Site Forge built. Each source runs the batteries that apply: copy rules on every sentence, web tests on the source, a license lookup on every number found, and the surfaces this page cannot see.</p></div><div class="card-b">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn" id="s10SrcP" aria-pressed="true">Paste HTML or text</button><button class="btn sec" id="s10SrcD" aria-pressed="false">Campaign Desk feed</button><button class="btn sec" id="s10SrcF" aria-pressed="false">Site Forge feed</button><button class="btn ghost" id="s10Sample">Load a sample competitor page</button></div>
        <div id="s10Paste"><div class="plan"><div class="f wide"><label class="fl" for="s10Text">HTML or text</label><textarea id="s10Text" class="code" style="min-height:160px" placeholder="&lt;html&gt; ... or the text of an ad"></textarea></div><div class="f"><label class="fl" for="s10Label">Label</label><input type="text" id="s10Label" placeholder="competitor.com/ac-replacement"></div></div><div style="margin-top:8px"><button class="btn" id="s10Run">Run the batteries</button></div></div>
        <div class="mini" id="s10Note" style="margin-top:8px"></div>
      </div></div>
      <div class="kpis" id="s10Kpis"></div>

      <div class="card mt"><div class="card-h"><h3>Stage 5 · Findings</h3><p>One row per rule and source. Click a row for the rule as cited, the evidence, how it was dispositioned, what would settle it and where it goes.</p></div><div class="card-b">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px"><div class="ctl"><label class="fl" for="s10FD">Disposition</label><select id="s10FD"><option value="">All</option>${DISPS.map(d => `<option>${d}</option>`).join('')}</select></div><div class="ctl"><label class="fl" for="s10FF">Enforcer family</label><select id="s10FF"><option value="">All</option></select></div></div>
        <div class="split21"><div class="tscroll" id="s10Tbl" style="min-width:0"></div><div id="s10Det" class="stack" style="min-width:0"><p class="mini">Run a source, then click a row.</p></div></div>
      </div></div>

      <div class="card mt"><div class="card-h"><h3>Stage 6 · The controls gate</h3><p>Every candidate binds to exactly one disposition. Tick a control that is in place for this target, and the candidates and notes it answers move to CLEARED with the control named. Confirmed findings move only by hand, in the detail pane.</p></div><div class="card-b"><div class="stack" id="s10Ctrl"></div></div></div>

      <div class="split">
        ${card('License lookups: the six way null result taxonomy', 'A blank lookup is never a finding by itself. Record which of the six it is.', `<ol class="steps">${[
          ['Not tested', 'The number is outside the 12 county extract, or the live TDLR search could not be reached. Record NOT_TESTED, never clean.'],
          ['Spelled differently', 'Search the LLC, Inc and assumed name variants, and the number without its TACLA or TACLB prefix.'],
          ['Held by an individual', 'Texas air conditioning contractor licenses are issued to people; a company works under a licensee\'s number. Search the licensee, not only the brand.'],
          ['Exempt activity', 'Occupations Code §1302.056 exempts some work, such as a homeowner working on their own home. Exempt work is not unlicensed work. ◐'],
          ['Registry lag', 'New and renewed licenses can take days to reach the open data file. Check the live TDLR search on the day.'],
          ['Genuinely unlicensed or lapsed', 'Only after the five above are excluded, and CONFIRMED only with a dated screenshot of the live TDLR search.']].map(([t, d]) => `<li><b>${t}.</b> ${d}</li>`).join('')}</ol>
          <div class="dsec" style="margin-top:12px">Look up a license</div><div style="display:flex;gap:6px;flex-wrap:wrap"><input type="search" id="s10LQ" placeholder="number or business name" style="flex:1;min-width:180px"><button class="btn sec sm" id="s10LGo">Search</button></div><div id="s10LRes" class="mt"></div>`)}
        ${card('Routing: where a finding goes, what it needs, what it does', 'Most findings route nowhere; they are intelligence. Competitor findings that route anywhere carry the evidence bar.', '<div class="xscroll" id="s10Route"></div>')}
      </div>
      <div class="card mt"><div class="card-h"><h3>The statute book</h3><p>Every rule the batteries apply. ✔ marks a primary text read for this build (September 2026). ◐ marks a secondary source or memory: fetch the live text before it appears in a confirmed finding. Section numbers change and rules get vacated; a wrong cite is worse than no cite.</p></div><div class="card-b"><div class="xscroll" id="s10BookT"></div></div></div>
      <div class="split">
        ${card('How the Satchel is built', '', judgList([
          ['Dispositions', 'A block level rule with its primary text read (✔) and a match in observable text is CONFIRMED. A ◐ rule, or any warning, is a CANDIDATE until the open question is closed. Notes are INTEL. Surfaces this page cannot see are NOT_OBSERVABLE. Controls move candidates to CLEARED.'],
          ['Batteries', 'Copy rules run sentence by sentence and are counted per source; the license rule runs once per asset set; web tests read the raw source for pixels, prechecked boxes, self served ratings and the license number; the license battery looks up every TACLA or TACLB number in the TDLR file.'],
          ['House style', 'In self audit posture, the house rules block any hyphen or dash and any meta note or placeholder in copy. They are off in competitor posture: style is not a violation.'],
          ['What it does not do', 'It fetches nothing, files nothing and contacts no platform. It does not screen vehicles, invoices or permits it cannot see; those rows ship as NOT_OBSERVABLE with the check to run in person.']]))}
        ${card('Judgment calls', '', judgList([
          ['TAX1 reads negations', 'A sentence saying the federal credit ended does not trip the tax credit rule; a sentence offering it does.'],
          ['INS1 is marked ◐', 'The insurance code limits on contractors adjusting claims and waiving deductibles are cited from memory; read chapters 4102 and 707 before a finding goes out.'],
          ['License file vintage', `The lookup is the TDLR open data file as of ${LICX.asof}: active licenses and those expired within two years, for the 12 counties only. Owner names and addresses are left out.`],
          ['Permit capture is intelligence', 'The atlas measures about one permit per five modeled replacements in three cities. That is a market fact, not evidence against any one contractor.']]))}
      </div>
      <div class="card mt"><div class="card-h"><h3>Sources</h3></div><div class="card-b">${srcRows([
        ['TDLR advertising, vehicles and consumer notice', '16 Tex. Admin. Code §75.71 (Cornell LII)', 'A', 'read Sep 25, 2026', 'https://www.law.cornell.edu/regulations/texas/16-Tex-Admin-Code-SS-75-71'],
        ['License file', 'Texas Open Data Portal, TDLR All Licenses (7358-krk7)', 'A', LICX.asof, 'https://data.texas.gov/resource/7358-krk7'],
        ['Consumer reviews rule', 'FTC Trade Regulation Rule on the Use of Consumer Reviews and Testimonials, 16 CFR Part 465 (eCFR)', 'A', 'effective Oct 21, 2024', 'https://www.ecfr.gov/current/title-16/part-465'],
        ['Free offers', 'FTC Guide Concerning Use of the Word "Free", 16 CFR Part 251 (eCFR)', 'B', '', 'https://www.ecfr.gov/current/title-16/part-251'],
        ['Credit advertising', 'Regulation Z, 12 CFR §1026.24 (eCFR)', 'B', '', 'https://www.ecfr.gov/current/title-12/section-1026.24'],
        ['Texting', 'Morgan Lewis, Texas Telephone Solicitation Law Now Covers Texts (SB 140, Bus. & Com. Code ch. 302)', 'B', 'Sep 2025', 'https://www.morganlewis.com/pubs/2025/09/texas-telephone-solicitation-law-now-covers-text-messages'],
        ['Federal credit status', 'IRS, Energy Efficient Home Improvement Credit', 'A', 'read Sep 25, 2026', 'https://www.irs.gov/credits-deductions/energy-efficient-home-improvement-credit'],
        ['Meta financial products category', 'Jon Loomer, Financial Products and Services Special Ad Category', 'B', '2025', 'https://www.jonloomer.com/qvt/financial-products-and-services/'],
        ['Google Advanced Verification', 'Google Ads Help, Advanced Verification policies', 'B', '', 'https://support.google.com/adspolicy/answer/7167922']])}</div></div>
      </div>`;

    /* ---------- stage 0 ---------- */
    wireSeg($('#s10Pos', root), v => { ST.posture = v; rerun(); });
    $('#s10Target', root).value = ST.target; $('#s10Domain', root).value = ST.domain; $('#s10Lic', root).value = ST.lic;
    $('#s10Target', root).onchange = e => { ST.target = e.target.value.trim(); rerun(); }; $('#s10Domain', root).onchange = e => { ST.domain = e.target.value.trim(); };
    $('#s10Lic', root).onchange = e => { ST.lic = e.target.value.trim().toUpperCase(); rerun(); }; $('#s10Q', root).onchange = e => { ST.question = e.target.value; render(); };
    $$('#s10Plats button', root).forEach(b => b.onclick = () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); ST.plats = $$('#s10Plats button', root).filter(x => x.getAttribute('aria-pressed') === 'true').map(x => x.dataset.v); rerun(); });
    [['#s10sAds', 'ads'], ['#s10sWeb', 'web'], ['#s10sFleet', 'fleet'], ['#s10sPaper', 'paper']].forEach(([s, k]) => $(s, root).onchange = e => { ST.surf[k] = e.target.checked; rerun(); });

    /* ---------- batteries ---------- */
    function licenseBattery(text, where, add) {
      const found = new Map();
      const re1 = /\bTACL\s?([AB])\s?0*(\d{3,7})\s?([A-Z]{0,4})\b/gi; let m;
      while ((m = re1.exec(text))) found.set(+m[2], { raw: m[0].replace(/\s+/g, ''), cls: m[1].toUpperCase() });
      const re2 = /\blic(?:ense)?\.?\s*(?:no\.?|#|number)?\s*:?\s*#?\s*(\d{4,7})\b/gi;
      while ((m = re2.exec(text))) if (!found.has(+m[1])) found.set(+m[1], { raw: m[0].trim(), cls: '' });
      found.forEach((f, n) => { const r = LICX.map.get(n);
        if (!r) { add('LICNONE', where, `${f.raw}: no A/C contractor license ${n} in the 12 county file`); return; }
        const exp = +r[3], nowN = ymdN(today), soon = ymdN(new Date(today.getTime() + 90 * 864e5)); const nm = r[1] || 'unnamed', cls = SUBCLS(r[2]);
        if (exp < nowN) add('LICEXP', where, `${f.raw}: ${nm}, expired ${fmtE(r[3])} (${LICX.counties[r[4]]} County)`);
        else { add('LICOK', where, `${f.raw}: ${nm}, Class ${cls || '?'}, active until ${fmtE(r[3])} (${LICX.counties[r[4]]} County)`); if (exp <= soon) add('LICSOON', where, `${f.raw}: ${nm} expires ${fmtE(r[3])}, inside 90 days`); }
        if (f.cls && cls && f.cls !== cls) add('LICCLASS', where, `${f.raw} advertised as Class ${f.cls}; the file shows Class ${cls}`);
        if (ST.target && nm && !nameMatch(nm, ST.target)) add('LICNAME', where, `${f.raw} is licensed to ${nm}; the advertised brand is ${ST.target}`); });
      return found.size;
    }
    const nameMatch = (a, b) => { const t = s => String(s).toLowerCase().replace(/\b(llc|inc|co|corp|company|the|and|&|services?|heating|air|conditioning|a\/c|ac|hvac|of|texas|tx|dfw)\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(x => x.length > 2); const A = t(a), B = t(b); return !A.length || !B.length || A.some(x => B.includes(x)); };
    function screen(items, srcLabel) {
      const agg = new Map(); const comp = ST.posture === 'comp';
      const add = (rid, where, ev, n) => { const R0 = RULE[rid] || {}; if ((R0.sev === 'note' || /^LIC/.test(rid)) && items.length > 1 && R0.obs !== false) where = srcLabel; const k = rid + '|' + where; if (!agg.has(k)) agg.set(k, { rid, where, ev: [], n: 0 }); const a = agg.get(k); a.n += n || 1; if (a.ev.length < 3 && !a.ev.includes(ev)) a.ev.push(ev); };
      items.forEach(it => {
        const group = it.group || srcLabel; const text = it.text || '';
        if (ST.surf.ads || ST.surf.web) sentences(text).forEach(sen => satchelLint(sen, { platform: it.plat, web: it.plat === 'web', noHouse: comp }).forEach(l => add(l.rule.id, group, `"${sen.slice(0, 170)}${sen.length > 170 ? '…' : ''}"`)));
        satchelLint(text + ' ' + (it.html || ''), { needLic: true, lic: ST.lic, page: !!it.page, noHouse: true }).filter(l => l.rule.id === 'TDLR1' || l.rule.id === 'TDLR2').forEach(l => add(l.rule.id, group, `${it.label}: ${l.ev}`));
        if (it.html && ST.surf.web) SAT.web.forEach(w => { const ev = w.test(it.html); if (ev) add(w.id, group, `${it.label}: ${ev}`); });
        licenseBattery(text + ' ' + (it.html || ''), group, (rid, wh, ev) => add(rid, wh, ev));
      });
      if (ST.surf.fleet) add('VEH1', 'Trucks and signage', 'Not observable from here: photograph both sides of every vehicle.');
      if (ST.surf.paper) { add('PAPER1', 'Proposals and invoices', 'Not observable from here: pull three recent proposals and invoices.'); add('PERMIT1', 'Permits', 'Not observable from here: match recent installs to the city permit search.'); add('EPA608', 'Refrigerant records', 'Not observable from here: check 608 cards and recovery logs.'); }
      return [...agg.values()].map(a => { const r = RULE[a.rid] || { id: a.rid, name: a.rid, sev: 'note', v: '◐', fam: '' };
        const s = r.obs === false ? 'NOT_OBSERVABLE' : a.rid === 'LICNONE' ? 'NOT_OBSERVABLE' : r.sev === 'note' ? 'INTEL' : (r.sev === 'block' && r.v === '✔') ? 'CONFIRMED' : 'CANDIDATE';
        return { key: a.rid + '|' + a.where, rid: a.rid, fam: r.fam || 'Web', name: r.name, sev: r.sev, v: r.v, cite: r.cite, fix: r.fix || '', route: r.route || routeFor(r), where: a.where, n: a.n, ev: a.ev, s0: s }; });
    }
    function routeFor(r) { const f = r.fam || ''; return /TDLR/.test(f) ? 'TDLR complaint (competitor) or remediation (self)' : /City/.test(f) ? 'City building official' : /EPA/.test(f) ? 'EPA tip line' : /Web/.test(f) ? 'Remediation (self); intelligence (competitor)' : 'Intelligence'; }
    function applyControls(list) { return list.map(f => { const o = Object.assign({}, f, { s: f.s0, moved: '' }); if (OVR[f.key]) { o.s = OVR[f.key]; o.moved = 'moved by hand'; return o; }
      if (o.s === 'CANDIDATE' || o.s === 'INTEL') { for (const [cid, label, ids] of SAT.controls) { if (CTRL[cid] && (ids.includes(o.rid) || (CTRL_EXTRA[cid] || []).includes(o.rid))) { o.s = 'CLEARED'; o.moved = 'control: ' + label; break; } } } return o; }); }
    function settleText(f) {
      const M = { REGZ1: 'Who is the creditor, and does the landing page carry the APR, the terms of repayment and the down payment beside the trigger term?', FREE1: 'What are the conditions, and are they beside the offer on the same page?', GUAR1: 'What exactly is guaranteed, for how long, and where are the terms?', SUP1: 'Ask for the basis: the survey, the award, the review count and its date.', REV1: 'Does the count and rating match the live profile today? Were reviews solicited with incentives or filtered?', URG1: 'Is there a real end date or a real capacity limit?', R22A: 'Is the claim used to push a replacement on a working system?', EFF1: 'Is the rating the AHRI certified rating of the matched system?', ES1: 'Are the advertised models ENERGY STAR certified, and is the mark used as a product label, not an endorsement?', LIC2: 'Is the proof on file: certificate of insurance, NATE or 608 cards, the dealer letter?', AVL1: 'Is the stated availability actually staffed?', SMS1: 'Is there an unchecked consent box, STOP language and a chapter 302 registration or exemption?', INS1: 'Does the business adjust or negotiate claims, or pay or waive deductibles, in practice?', TDLR2: 'Do proposals, invoices and contracts carry the notice?', LICSOON: 'Has the renewal been filed?', LICEXP: 'What does the live TDLR search show today?', LICCLASS: 'Which class does the live TDLR search show?', META1: 'Does the copy assert something about the viewer\'s own situation?', META2: 'Is the financing creative in a separate campaign under the special ad category?', GGL1: 'Recase or remove the character.', WEB1: 'Is there a privacy notice linked from every page with the tag?', WEB3: 'Remove the self served rating from the schema.' };
      return M[f.rid] || 'Write the exact open question and the evidence that would close it.'; }

    /* ---------- sources ---------- */
    function setSrc(s) { [['#s10SrcP', 'paste'], ['#s10SrcD', 'desk'], ['#s10SrcF', 'forge']].forEach(([id, v]) => { const b = $(id, root); b.className = 'btn' + (v === s ? '' : ' sec'); b.setAttribute('aria-pressed', String(v === s)); }); $('#s10Paste', root).hidden = s !== 'paste'; }
    function ensureMounted(key) { const m = MODI[key]; if (!m) return null; if (!m.mounted) { m.mounted = true; try { m.mount($('#mod-' + key)); } catch (e) { console.error(e); return null; } } return m; }
    let LASTRUN = null;
    function runItems(items, src, label) { LASTRUN = { items, src, label }; FIND = screen(items, label); LAST = { src, label }; SEL = null; render(); $('#s10Note', root).textContent = `${src}: ${label}. ${items.length} item${items.length === 1 ? '' : 's'} screened.`; }
    function rerun() { if (LASTRUN) { FIND = screen(LASTRUN.items, LASTRUN.label); render(); } else render(); }
    $('#s10SrcP', root).onclick = () => setSrc('paste');
    $('#s10SrcD', root).onclick = () => { setSrc('desk'); const m = ensureMounted('desk'); if (!m || !m.feed) { $('#s10Note', root).textContent = 'The Campaign Desk is not available.'; return; } const feed = m.feed().filter(a => ST.plats.includes(a.plat)); if (!feed.length) { $('#s10Note', root).textContent = 'The Campaign Desk has no assets for the platforms in scope.'; return; } runItems(feed.map(a => ({ label: a.label, text: a.text, plat: a.plat, group: 'Campaign Desk · ' + PLAB[a.plat] })), 'Campaign Desk', `${feed.length} assets across ${[...new Set(feed.map(a => a.plat))].length} platforms`); };
    $('#s10SrcF', root).onclick = () => { setSrc('forge'); const m = ensureMounted('forge'); if (!m || !m.feed) { $('#s10Note', root).textContent = 'The Site Forge is not available.'; return; } const pages = m.feed(); runItems(pages.map(p => ({ label: p.label, text: p.text, html: p.html, plat: 'web', page: true, group: 'Site Forge · ' + p.label.split(' · ')[1] + ' pages' })), 'Site Forge', `${pages.length} pages`); };
    $('#s10Run', root).onclick = () => { const raw = $('#s10Text', root).value; if (!raw.trim()) { $('#s10Note', root).textContent = 'Nothing pasted.'; return; } const isHtml = /<[a-z][\s\S]*>/i.test(raw); const label = $('#s10Label', root).value.trim() || (isHtml ? 'pasted page' : 'pasted text'); runItems([{ label, text: isHtml ? strip(raw) : raw, html: isHtml ? raw : '', plat: 'web', page: isHtml, group: label }], 'Pasted ' + (isHtml ? 'HTML' : 'text'), label); };
    const SAMPLE = `<!doctype html><html><head><title>Polar Peak Heating & Air | #1 AC Company in Frisco</title>
<script src="https://connect.facebook.net/en_US/fbevents.js"><\/script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"HVACBusiness","name":"Polar Peak Heating & Air","aggregateRating":{"@type":"AggregateRating","ratingValue":"5.0","reviewCount":"1200"}}<\/script></head>
<body><h1>Frisco's Best HVAC Company, 5 Star Rated</h1>
<p>Get a new AC for $0 down and 60 months no interest. Plus claim your 30% federal tax credit on every install.</p>
<p>R-22 systems are now illegal to run. Replace yours before the ban hits.</p>
<p>FREE tune-up with any repair. Lifetime warranty on every system.</p>
<p>Only 3 slots left this week. Act now!</p>
<p>Hail damage? We handle your insurance claim and can waive your deductible.</p>
<p>24/7 emergency service. Licensed and insured, NATE certified technicians. TACLB 2090991C.</p>
<p>SEER 22 systems, ENERGY STAR partner.</p>
<form><label><input type="checkbox" name="sms" checked> Yes, text me offers</label> We'll text you special offers.</form>
</body></html>`;
    $('#s10Sample', root).onclick = () => { setSrc('paste'); $('#s10Text', root).value = SAMPLE; $('#s10Label', root).value = 'polarpeak.example/ac-replacement (fictional)'; wireSegSet('comp'); ST.target = 'Polar Peak Heating and Air'; $('#s10Target', root).value = ST.target; $('#s10Q', root).value = 'report'; ST.question = 'report'; $('#s10Run', root).click(); };
    function wireSegSet(v) { ST.posture = v; $$('#s10Pos button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); }

    /* ---------- render ---------- */
    function renderCtrl() { $('#s10Ctrl', root).innerHTML = SAT.controls.map(([id, label, ids]) => `<label class="chk" style="align-items:flex-start"><input type="checkbox" data-c="${id}" ${CTRL[id] ? 'checked' : ''}> <span>${esc(label)} <span class="mini">answers ${ids.concat(CTRL_EXTRA[id] || []).join(', ')}</span></span></label>`).join('');
      $$('#s10Ctrl [data-c]', root).forEach(i => i.onchange = () => { CTRL[i.dataset.c] = i.checked; render(); }); }
    function render() {
      const L = applyControls(FIND); const cnt = d => L.filter(f => f.s === d).length;
      $('#s10Kpis', root).innerHTML = kpiHTML([{ l: 'Confirmed', v: N(cnt('CONFIRMED')), d: ST.posture === 'self' ? 'fix before anything runs' : 'observable, primary text read' }, { l: 'Candidates', v: N(cnt('CANDIDATE')), d: 'open question to close' }, { l: 'Cleared', v: N(cnt('CLEARED')), d: 'by a control or by hand' }, { l: 'Not observable', v: N(cnt('NOT_OBSERVABLE')), d: 'check in person' }, { l: 'Intelligence', v: N(cnt('INTEL')), d: 'held in house' }, { l: 'Answer', v: answer(L), d: LAST.src ? esc(LAST.src) : 'no source run yet' }]);
      const fams = [...new Set(L.map(f => f.fam))].sort(); const ff = $('#s10FF', root); const cur = ff.value; ff.innerHTML = '<option value="">All</option>' + fams.map(f => `<option ${f === cur ? 'selected' : ''}>${esc(f)}</option>`).join('');
      FDISP = $('#s10FD', root).value; FFAM = ff.value;
      const rows = L.filter(f => (!FDISP || f.s === FDISP) && (!FFAM || f.fam === FFAM)).sort((a, b) => DISPS.indexOf(a.s) - DISPS.indexOf(b.s) || ['block', 'warn', 'note'].indexOf(a.sev) - ['block', 'warn', 'note'].indexOf(b.sev));
      const host = $('#s10Tbl', root);
      if (!rows.length) host.innerHTML = `<p class="mini">${FIND.length ? 'No findings match the filters.' : 'Run a source to screen it.'}</p>`;
      else dataTable(host, [{ k: 's', h: 'Disp.', l: 1, v: f => DISPS.indexOf(f.s), f: (v, f) => `<span class="disp ${DCLS[f.s]}">${f.s.replace('_', ' ')}</span>` }, { k: 'rid', h: 'Rule', l: 1, f: (v, f) => `<b>${esc(v)}</b> ${glyph(f.v)} <span class="mini">${esc(f.fam)}</span><br><span class="mini">${esc(f.name)}</span>` }, { k: 'where', h: 'Where', l: 1, f: v => `<span class="mini">${esc(v)}</span>` }, { k: 'n', h: 'Hits', f: v => N(v) }],
        rows, { id: f => f.key, sortKey: 's', sortDir: 1, rowClass: f => f.key === SEL ? 'sel' : '', onClick: k => { SEL = k; render(); } });
      renderDetail(L); renderRoute(L);
    }
    function answer(L) { const c = L.filter(f => f.s === 'CONFIRMED').length, k = L.filter(f => f.s === 'CANDIDATE').length; if (!FIND.length) return '—';
      if (ST.question === 'safe') return c ? 'Not yet' : k ? 'With fixes' : 'Yes';
      if (ST.question === 'report') return c ? `${c} to file` : 'Nothing to file';
      return `${c + k} items`; }
    function renderDetail(L) { const f = L.find(x => x.key === SEL); const host = $('#s10Det', root); if (!f) { host.innerHTML = `<p class="mini">${FIND.length ? 'Click a row for the detail.' : 'Run a source, then click a row.'}</p>`; return; }
      const self = ST.posture === 'self';
      host.innerHTML = `<div><span class="disp ${DCLS[f.s]}">${f.s.replace('_', ' ')}</span> ${f.moved ? `<span class="mini">${esc(f.moved)}</span>` : ''}<h3 style="margin:8px 0 4px">${esc(f.rid)} · ${esc(f.name)}</h3><div class="mini">${esc(f.cite || '')} ${glyph(f.v)} · ${esc(f.fam)} · severity ${esc(f.sev)}</div></div>
        <div><div class="dsec">Evidence</div>${f.ev.map(e => `<div class="asset">${esc(e)}</div>`).join('')}<div class="mini">${esc(f.where)} · ${N(f.n)} hit${f.n === 1 ? '' : 's'}</div></div>
        ${f.s === 'CANDIDATE' ? `<div><div class="dsec">What would settle it</div><p style="margin:0;font-size:12.5px">${esc(settleText(f))}</p></div>` : ''}
        <div><div class="dsec">${self ? 'The fix' : 'Where it goes'}</div><p style="margin:0;font-size:12.5px">${esc(self ? (f.fix || 'Remove or rewrite the claim.') : f.route)}</p>${!self && (f.s === 'CONFIRMED' || f.s === 'CANDIDATE') ? `<p class="mini" style="margin-top:6px">Evidence bar: a dated screenshot or saved source of each instance, the URL or ad ID, and for license findings the live TDLR search result on the same day.</p>` : ''}</div>
        <div><div class="dsec">Move by hand</div><div class="chips">${DISPS.map(d => `<button class="chip" data-m="${d}" aria-pressed="${f.s === d}">${d.replace('_', ' ')}</button>`).join('')}<button class="chip" data-m="">Reset</button></div></div>`;
      $$('[data-m]', host).forEach(b => b.onclick = () => { if (b.dataset.m) OVR[f.key] = b.dataset.m; else delete OVR[f.key]; render(); }); }
    const ROUTES = [
      ['TDLR', 'Online complaint to the Texas Department of Licensing and Regulation', 'The ad, page or truck with a date, the license search result, the business name and address', 'Investigation; administrative penalties and sanctions under Occupations Code chapters 51 and 1302', 'TDLR'],
      ['Texas Attorney General', 'Consumer Protection Division complaint (DTPA)', 'The claim, why it misleads, and ideally a consumer who relied on it', 'Pattern enforcement; single complaints are logged rather than pursued', 'DTPA'],
      ['FTC', 'ReportFraud.ftc.gov', 'Fake or incentivized reviews, lapsed credit claims, credit trigger terms', 'Feeds pattern cases; rarely a response to one report', 'FTC'],
      ['CFPB', 'Consumer complaint portal', 'Credit advertising by a creditor or a financing partner', 'Supervisory attention to the lender', 'CFPB'],
      ['Google Ads and LSA', 'Report a policy violation; Local Services "Report a problem"', 'Ad preview, the query and location, the landing page claim', 'Ad disapproval; repeated misrepresentation can suspend the account', 'Google Ads'],
      ['Meta', 'Report ad', 'The ad, the page and the claim', 'Ad rejection; advertiser restrictions for repeat violations', 'Meta'],
      ['Yelp', 'Report review solicitation', 'Evidence of asking for or paying for reviews', 'Consumer alert on the business page', 'FTC'],
      ['BBB National Programs', 'National Advertising Division challenge', 'A competitor claim that needs substantiation; a filing fee', 'The advertiser must substantiate or modify the claim', 'FTC / NAD'],
      ['Texas Department of Insurance', 'Complaint about a contractor acting as a public adjuster or waiving deductibles', 'The offer as published, with dates', 'Investigation under the insurance code', 'TDI / DTPA'],
      ['City building official', 'Code enforcement or permit office', 'An address and date of an install without a permit', 'Stop work, permit and inspection requirements', 'City'],
      ['EPA', 'Tip or complaint on refrigerant venting', 'Direct evidence of venting or uncertified handling', 'Clean Air Act enforcement', 'EPA']];
    function renderRoute(L) { const fams = new Set(L.filter(f => f.s === 'CONFIRMED' || f.s === 'CANDIDATE').map(f => f.fam));
      $('#s10Route', root).innerHTML = `<table class="prose"><thead><tr><th>Route</th><th>Channel</th><th>What it needs</th><th>What it does</th></tr></thead><tbody>${ROUTES.map(r => { const hot = [...fams].some(f => r[4].split(' / ').some(x => f.includes(x))); return `<tr${hot ? ' style="background:color-mix(in srgb,var(--accent) 10%,transparent)"' : ''}><td><b>${esc(r[0])}</b>${hot ? ' <span class="pill">in this run</span>' : ''}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`; }).join('')}</tbody></table>`; }
    function renderBook() { $('#s10BookT', root).innerHTML = `<table class="prose"><thead><tr><th>Rule</th><th>Family</th><th>Severity</th><th>What it catches</th><th>Cite</th><th>Fix</th></tr></thead><tbody>${ALLR.map(r => `<tr><td><b>${esc(r.id)}</b> ${glyph(r.v)}</td><td>${esc(r.fam || 'Web')}</td><td>${esc(r.sev)}</td><td>${esc(r.name)}</td><td>${esc(r.cite || '')}</td><td>${esc(r.fix || '')}</td></tr>`).join('')}</tbody></table>`; }
    $('#s10FD', root).onchange = render; $('#s10FF', root).onchange = render;

    /* ---------- license lookup ---------- */
    $('#s10LGo', root).onclick = () => { const q = $('#s10LQ', root).value.trim(); const host = $('#s10LRes', root); if (!q) { host.innerHTML = ''; return; } const num = q.replace(/^TACL[AB]/i, '').replace(/[^0-9]/g, '');
      const hits = num.length >= 3 ? LICX.rows.filter(r => String(r[0]) === num) : LICX.rows.filter(r => r[1] && nameMatch(r[1], q) && r[1].toLowerCase().includes(q.toLowerCase().split(/\s+/)[0])).slice(0, 12);
      host.innerHTML = hits.length ? hits.map(r => { const act = +r[3] >= ymdN(today); return `<div class="rowl"><span><b>TACL${SUBCLS(r[2]) || '?'}${r[0]}${esc((r[2] || '').slice(1, 2))}</b> ${esc(r[1] || 'unnamed')}<br><span class="mini">${esc(LICX.counties[r[4]])} County · endorsement code ${esc(r[2])}</span></span><b style="color:${act ? 'inherit' : 'var(--critical)'}">${act ? 'active to' : 'expired'} ${fmtE(r[3])}</b></div>`; }).join('') : `<p class="mini">Nothing in the 12 county file. Apply the taxonomy above before drawing any conclusion.</p>`; };
    $('#s10LQ', root).onkeydown = e => { if (e.key === 'Enter') $('#s10LGo', root).click(); };

    /* ---------- exports ---------- */
    $('#s10X', root).onclick = () => { const L = applyControls(FIND); if (!L.length) { toast('Run a source first'); return; } saveFile(`satchel-findings_${slug(ST.target || 'run')}.csv`, toCSV(['disposition', 'rule', 'vintage', 'family', 'severity', 'name', 'where', 'hits', 'evidence', 'cite', 'route', 'fix', 'moved'], L.map(f => [f.s, f.rid, f.v === '✔' ? 'read' : 'verify', f.fam, f.sev, f.name, f.where, f.n, f.ev.join(' | '), f.cite, f.route, f.fix, f.moved]), `Emergency Satchel ${SAT.version}; posture ${ST.posture}; target ${ST.target}; source ${LAST.src}: ${LAST.label}`)); };
    $('#s10Book', root).onclick = () => saveFile('satchel-statute-book.csv', toCSV(['rule', 'vintage', 'family', 'severity', 'name', 'cite', 'fix'], ALLR.map(r => [r.id, r.v === '✔' ? 'read' : 'verify', r.fam || 'Web', r.sev, r.name, r.cite || '', r.fix || ''])));
    $('#s10Md', root).onclick = () => { const L = applyControls(FIND); if (!L.length) { toast('Run a source first'); return; } const by = d => L.filter(f => f.s === d);
      const sec = (d, t) => by(d).length ? `\n## ${t} (${by(d).length})\n\n` + by(d).map(f => `**${f.rid}: ${f.name}.** ${f.where}, ${f.n} hit${f.n === 1 ? '' : 's'}. ${f.cite}${f.v === '✔' ? '' : ' (verify the live text)'}.\n\nEvidence: ${f.ev.join('; ')}\n\n${ST.posture === 'self' ? 'Fix: ' + (f.fix || 'Remove or rewrite the claim.') : 'Route: ' + f.route}${f.moved ? '\n\nDisposition moved: ' + f.moved : ''}\n`).join('\n') : '';
      saveFile(`satchel-report_${slug(ST.target || 'run')}.md`, `# Emergency Satchel screen: ${ST.target || 'unnamed target'}\n\nPosture: ${ST.posture === 'self' ? 'self audit' : 'competitor'}. Question: ${$('#s10Q', root).selectedOptions[0].textContent} Answer: ${answer(L)}.\nSource: ${LAST.src}, ${LAST.label}. Rule pack ${SAT.version}.\n` + sec('CONFIRMED', 'Confirmed') + sec('CANDIDATE', 'Candidates') + sec('NOT_OBSERVABLE', 'Not observable from here') + sec('CLEARED', 'Cleared') + sec('INTEL', 'Intelligence')); };

    /* ---------- hooks ---------- */
    this.receive = p => { if (!p) return; if (p.posture) wireSegSet(p.posture); if (p.target) { ST.target = p.target; $('#s10Target', root).value = p.target; } if (p.domain) { ST.domain = p.domain; $('#s10Domain', root).value = p.domain; } if (p.posture === 'comp') { $('#s10Label', root).value = p.domain || ''; $('#s10Note', root).textContent = `Target set to ${p.target}. Paste the page source from ${p.domain || 'its site'} and run the batteries.`; } else render(); };
    renderCtrl(); renderBook(); render();
  }
});
