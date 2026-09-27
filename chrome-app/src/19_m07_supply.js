/* ==== m07_supply ==== */
"use strict";
/* ============================ Module 7: Supply Line (contractors, technicians, the competitive field) ============================ */
registerModule({
  key: 'supply', num: '07', title: 'Supply Line', desc: 'Contractors, technicians and the 242-location competitive field from the heatmap',
  mount(root) {
    const st = { sel: BENCH ? COMP.indexOf(BENCH) : null, sort: 'reviews', tiers: { integrity: true, top40: true, roster: true }, minrev: 0, q: '', city: '', base: 'sys_per_est8', view: 'map' };
    const HM = DATA.hm; const others = COMP.filter(l => l.tier !== 'integrity');
    const revRank = BENCH ? others.filter(l => (l.reviews || 0) > (BENCH.reviews || 0)).length + 1 : null;
    const drs = others.map(l => l.dr).filter(isN); const drPct = BENCH ? Math.round(100 * drs.filter(d => d < (BENCH.dr || 0)).length / drs.length) : null;
    root.innerHTML = mastHTML({ eyebrow: 'Module 07 · Supply Line · contractors, technicians and the competitive field', title: 'Supply Line', dek: 'Who is already standing in front of the demand: the 242 competitor locations researched for the original heatmap with their reviews, domain strength, traffic and website intel; the licensed contractors and technicians TDLR holds for each county; and the Census count of HVAC establishments, a decade apart.',
      meta: [`<b>${N(COMP.length)}</b> mapped locations · <b>${N(META.comp_reviews)}</b> Google reviews`, `<b>${N(META.lic_con_dfw)}</b> contractor licenses · <b>${N(META.lic_tech_dfw)}</b> technicians`, `<b>${N(META.cbp.e23)}</b> establishments (2023)`, `<b>Roster date</b> ${esc(DATA.comp_generated || '2026-08-18')}`],
      bar: 'Supply Line', barsub: 'Competitive field, licensed workforce, establishments', actions: [{ id: 's7Csv', label: '↓ Competitors CSV' }, { id: 's7View', label: 'Table view' }, { id: 's7Watch', label: 'Competitor Watch ↗', title: 'Ads, offers and observations for the selected company (module 13)' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: three contractor counts, three denominators', `Anyone quoting "the number of HVAC contractors" must say which. <b>TDLR</b> counts licenses: ${N(META.lic_con_dfw)} active air conditioning and refrigeration contractor licenses list a business county in the 12 counties, and ${N(META.lic_tech_dfw)} technicians work under them. The <b>Census</b> counts establishments with employees: ${N(META.cbp.e23)} plumbing, heating and air conditioning establishments (NAICS 238220) in the study ZIPs in 2023, up ${P((META.cbp.e23 / META.cbp.e16 - 1) * 100, 0)} from 2016, plumbers included. The <b>heatmap</b> counts the competitors that matter in search: ${N(COMP.length)} researched locations carrying ${N(META.comp_reviews)} Google reviews. This module uses each for what it measures and says which on every panel.`)}
      <div class="callout note" id="s7Bench"></div>
      <div class="kpis" id="s7Kpis"></div>
      <div class="controls">
        <div class="ctl" style="flex:1 1 200px"><label class="fl" for="s7Q">Search</label><input type="search" id="s7Q" placeholder="company, city or domain"></div>
        <div class="ctl"><label class="fl" for="s7City">City</label><select id="s7City"><option value="">All cities</option>${[...new Set(COMP.map(l => l.city))].sort().map(c => `<option>${esc(c)}</option>`).join('')}</select></div>
        <label class="chk"><input type="checkbox" data-t="integrity" checked><span class="bench-dot"></span>Benchmark</label>
        <label class="chk"><input type="checkbox" data-t="top40" checked><span class="sev" style="background:var(--s1)"></span>Deep dive (50)</label>
        <label class="chk"><input type="checkbox" data-t="roster" checked><span class="sev" style="background:var(--ink-3)"></span>Roster (191)</label>
        <div class="ctl"><label class="fl" for="s7Min">Min reviews <span id="s7MinV">0</span></label><input type="range" id="s7Min" min="0" max="2000" step="50" value="0"></div>
        <div class="ctl"><label class="fl" for="s7Base">Base map</label><select id="s7Base"><option value="sys_per_est8">Systems per contractor within 8 km</option><option value="comp_mass">Competitor review mass</option><option value="rep">Replacements due 2026</option><option value="effb">Paid efficiency</option><option value="none">No base layer</option></select></div>
      </div>
      <div id="s7MapView" class="grid3s">
        <div class="card" style="max-height:760px;display:flex;flex-direction:column"><div class="card-h" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><h3 style="flex:1">Deep-dive rankings</h3><div class="seg" id="s7Sort"><button data-v="reviews" aria-pressed="true">Reviews</button><button data-v="dr" aria-pressed="false">DR</button><button data-v="traffic" aria-pressed="false">Traffic</button></div></div><div id="s7Rank" style="overflow-y:auto;flex:1"></div></div>
        <div class="card mapcard"><div id="s7Map"></div><div class="legend" id="s7Leg"></div></div>
        <div class="card" style="max-height:760px;overflow:auto"><div class="card-h"><h3 id="s7DName"></h3><p id="s7DSub"></p></div><div class="card-b" id="s7Det"></div></div>
      </div>
      <div id="s7TblView" class="card mt" hidden><div class="tscroll tall" id="s7Tbl"></div></div>
      <div class="split">
        ${card('A decade of establishments, 2016 against 2023', 'HVAC and plumbing establishments per 10,000 households by county (ZIP Code Business Patterns, apportioned by 2020 block housing).', '<div id="s7Cbp"></div><p class="chartnote" id="s7CbpN"></p>')}
        ${card('The licensed workforce by county', 'Active TDLR licenses. Systems per technician is the load each licensed tech would carry if every system were serviced.', '<div class="tscroll short" id="s7Tdlr"></div><p class="chartnote" id="s7TdlrN"></p>')}
      </div>
      <div class="split">
        ${card('The heatmap\'s city focus model, carried forward', 'The original breakdown-risk demand model (80 cities, August 2026) against this atlas\'s ZIP model rolled up to the same cities.', '<div id="s7Focus"></div>')}
        ${card('What the supply layer means for a contractor', 'Five readings.', '<ol class="meth" id="s7Read"></ol>')}
      </div>
      <div class="split">${card('Judgment calls', '', '<div id="s7Judg"></div>')}${card('Source register', '', '<div id="s7Src"></div>')}</div>
      <div class="foot">DFW Thermal Debt Atlas, module 07. Competitor data are point-in-time (Google Business Profile via public listings and directories, Ahrefs, company websites; August 18, 2026). Ahrefs paid data excludes Google Local Services Ads. No new Ahrefs pull was made for this build.</div></div>`;
    if (BENCH) $('#s7Bench', root).innerHTML = `<span class="ct">Benchmark: ${esc(BENCH.name)}, ${esc(BENCH.city)}</span><span class="bench-dot"></span>Google ${D(BENCH.rating, 1)}★ · ${N(BENCH.reviews)} reviews (#${revRank} of ${COMP.length} by reviews) · Domain Rating ${D(BENCH.dr, 1)} (beats ${drPct}% of tracked domains; median DR ${D(median(drs), 0)}) · ${N(BENCH.org_kw)} ranking keywords · ${N(BENCH.org_traffic)} organic visits a month · $0 paid search detected. ${esc(BENCH.intel && BENCH.intel.key_notes || '')}`;
    const top = COMP.filter(l => l.tier !== 'roster');
    $('#s7Kpis', root).innerHTML = kpiHTML([
      { l: 'Mapped locations', g: 'C', v: N(COMP.length), d: `${N(new Set(COMP.map(l => l.domain || l.name)).size)} companies, ${N(new Set(COMP.map(l => l.city)).size)} cities` },
      { l: 'Google reviews', g: 'C', v: K(META.comp_reviews), d: `median ${N(median(COMP.map(l => l.reviews)))} a location` },
      { l: 'Running paid search', g: 'C', v: N(top.filter(l => (l.paid_kw || 0) > 0).length), d: `of ${top.length} deep-dive companies (Ahrefs, excludes LSA)` },
      { l: 'Contractor licenses', g: 'A', v: N(META.lic_con_dfw), d: `${P(META.lic_conA_dfw / META.lic_con_dfw * 100, 0)} Class A` },
      { l: 'Technicians', g: 'A', v: N(META.lic_tech_dfw), d: `${P(META.lic_cert_dfw / META.lic_tech_dfw * 100, 0)} certified; ${N(META.sys / META.lic_tech_dfw)} systems each` },
      { l: 'Establishments', g: 'B', v: N(META.cbp.e23), d: `${S((META.cbp.e23 / META.cbp.e16 - 1) * 100, 0)}% since 2016; all employers ${S((META.cbp.all23 / META.cbp.all16 - 1) * 100, 0)}%` },
    ]);
    const passes = l => st.tiers[l.tier] && (!st.city || l.city === st.city) && (l.tier === 'integrity' || (l.reviews || 0) >= st.minrev) && (!st.q || (l.name + ' ' + (l.domain || '') + ' ' + l.city).toLowerCase().includes(st.q));
    const map = new ZipMap($('#s7Map', root), { onSelect: () => { }, onHover: (zip, e) => { const z = ZI[zip]; if (!z || z.occ < 200 || st.base === 'none') return; const L = LAYERS[st.base] || { l: 'Paid efficiency', f: v => D(v, 0) }; showTip(`<div class="tt">${z.zip} · ${esc(z.city)}</div>${tipRow(L.l || st.base, (L.f || D)(z[st.base]))}${tipRow('Mapped competitors within 8 km', N(z.comp_n8))}`, e); }, onPin: id => { st.sel = +id; draw(); }, onPinHover: (id, e) => { const l = COMP[+id]; showTip(`<div class="tt">${esc(l.name)}</div><div class="ts">${esc(l.city)} · ${esc(l.domain || '')}</div>${tipRow('Rating', (l.rating || '—') + '★')}${tipRow('Reviews', N(l.reviews))}${tipRow('Domain Rating', D(l.dr, 0))}${tipRow('Organic visits/mo', N(l.org_traffic))}`, e); } });
    function draw() {
      const vis = COMP.map((l, i) => ({ l, i })).filter(x => passes(x.l));
      if (st.base === 'none') map.fill(() => cssv('--sunk')); else { const L = LAYERS[st.base] || { ramp: 'ember', dir: 1 }; const sc = qScale(ZR.map(z => z[st.base]), st.base === 'effb' || st.base === 'rep' ? 'ember' : 'blue', 1); map.fill(zip => { const z = ZI[zip]; return z && z.occ >= 200 ? sc.f(z[st.base]) : null; }); const v = ZR.map(z => z[st.base]).filter(isN); $('#s7Leg', root).innerHTML = legendHTML({ title: (LAYERS[st.base] || { l: 'Paid efficiency percentile' }).l, R: sc.R, lo: N(Math.min(...v)), hi: N(Math.max(...v)), note: 'Pins: <span class="bench-dot"></span>benchmark · blue deep-dive competitor · gray roster; size = Google reviews.' }); }
      if (st.base === 'none') $('#s7Leg', root).innerHTML = '<div class="dn">Pins: <span class="bench-dot"></span>benchmark · blue deep-dive competitor · gray roster; size = Google reviews.</div>';
      map.pins(vis.map(({ l, i }) => ({ id: i, lat: l.lat, lon: l.lon, r: l.tier === 'integrity' ? 8 : (l.tier === 'top40' ? 3.6 : 2.4) + Math.log10((l.reviews || 0) + 1) * (l.tier === 'top40' ? 1.4 : 0.8), fill: l.tier === 'integrity' ? cssv('--bench') : l.tier === 'top40' ? cssv('--s1') : cssv('--ink-3'), shape: l.tier === 'integrity' ? 'diamond' : '', sel: i === st.sel, op: l.tier === 'roster' ? .6 : .9 })));
      ranks(); detail(); if (st.view === 'table') table(vis);
    }
    function ranks() {
      const by = new Map(); COMP.forEach((l, i) => { if (l.tier === 'roster' || !passes(l)) return; const k = l.domain || l.name; if (!by.has(k)) by.set(k, { l, i, rev: 0, n: 0 }); const c = by.get(k); c.rev += (l.reviews || 0); c.n++; });
      const rows = [...by.values()]; const vk = r => st.sort === 'dr' ? (r.l.dr || 0) : st.sort === 'traffic' ? (r.l.org_traffic || 0) : r.rev; rows.sort((a, b) => vk(b) - vk(a)); const mx = Math.max(...rows.map(vk), 1);
      $('#s7Rank', root).innerHTML = rows.map((r, j) => `<div class="rk ${r.l.tier === 'integrity' ? 'bench' : ''} ${r.i === st.sel ? 'sel' : ''}" data-i="${r.i}"><div class="nm"><span class="rn">${j + 1}.</span>${esc(r.l.name.length > 34 ? r.l.name.slice(0, 33) + '…' : r.l.name)}</div><div class="me">${r.l.rating ?? '—'}★ · ${N(r.rev)} rev · DR ${D(r.l.dr, 0)} · ${N(r.l.org_traffic)} org/mo${(r.l.paid_kw || 0) > 0 ? ' · ADS' : ''}${r.n > 1 ? ' · ' + r.n + ' locations' : ''}</div><div class="bar" style="width:${Math.max(3, 88 * vk(r) / mx)}%"></div></div>`).join('');
      $$('#s7Rank .rk', root).forEach(d => d.onclick = () => { st.sel = +d.dataset.i; const l = COMP[st.sel]; draw(); });
    }
    function detail() {
      const l = COMP[st.sel]; if (!l) { $('#s7DName', root).textContent = 'Select a company'; $('#s7Det', root).innerHTML = ''; return; }
      $('#s7DName', root).textContent = l.name; $('#s7DSub', root).innerHTML = `<span class="pill">${l.tier === 'integrity' ? 'Benchmark client' : l.tier === 'top40' ? 'Deep-dive competitor' : 'Roster company'}</span> ${esc(l.scope || '')}`;
      const kv = (a) => a.filter(x => x[1] != null && x[1] !== '').map(([k, v]) => `<div class="rowl"><span>${k}</span><b style="font-weight:500;text-align:right">${v}</b></div>`).join('');
      const zz = ZI[l.zip];
      $('#s7Det', root).innerHTML = `<div class="dsec">Google Business Profile</div>${kv([['Rating', l.rating != null ? '★'.repeat(Math.round(l.rating)) + ' ' + D(l.rating, 1) : null], ['Reviews', l.reviews != null ? N(l.reviews) : null], ['Address', esc([l.street, l.city, l.zip].filter(Boolean).join(', '))], ['Phone', esc(l.phone || '')], ['Founded', l.founded], ['Data source', esc(l.rating_source || '')]])}
        ${(l.services || []).length ? `<div class="dsec">Services and brands</div><div>${l.services.map(s => `<span class="tag">${esc(s)}</span>`).join('')}${(l.brands || []).map(s => `<span class="tag on">${esc(s)}</span>`).join('')}</div>` : ''}
        ${l.domain ? `<div class="dsec">SEO (Ahrefs, Aug 2026)</div>${kv([['Domain', esc(l.domain)], ['Domain Rating', D(l.dr, 1)], ['Organic keywords', N(l.org_kw)], ['Organic visits a month', N(l.org_traffic)], ['Traffic value a month', isN(l.org_cost) ? M$(l.org_cost / 100) : null], ['Paid keywords', N(l.paid_kw)]])}` : ''}
        ${(l.kws || []).length ? `<div class="dsec">Top keyword rankings</div><table class="kwtab"><thead><tr><th class="l">Keyword</th><th>Pos</th><th>Vol</th><th>Visits</th></tr></thead><tbody>${l.kws.map(k => `<tr><td class="l wrap">${esc(k.kw)}</td><td><span class="pos ${k.pos <= 3 ? 'p1' : k.pos <= 10 ? 'p2' : 'p3'}">#${k.pos}</span></td><td>${N(k.vol)}</td><td>${N(k.traffic)}</td></tr>`).join('')}</tbody></table>` : ''}
        ${l.intel ? `<div class="dsec">Website intel</div>${[['Tagline', l.intel.tagline], ['Financing', l.intel.financing], ['Promos', l.intel.promos], ['Membership', l.intel.membership], ['Ad signals', l.intel.ad_signals], ['Notes', l.intel.key_notes]].filter(x => x[1] && x[1] !== '-').map(([k, v]) => `<p class="mini" style="color:var(--ink-2)"><b style="color:var(--ink)">${k}:</b> ${esc(v)}</p>`).join('')}` : ''}
        ${l.notes ? `<div class="dsec">Research notes</div><p class="mini" style="color:var(--ink-2)">${esc(l.notes)}</p>` : ''}
        ${zz ? `<div class="dsec">Home ZIP ${zz.zip} (atlas)</div>${kv([['Replacements due 2026', N(zz.rep)], ['Thermal Debt Index', D(zz.idx, 0)], ['Paid quadrant', ['Anchor', 'Whitespace', 'Niche', 'Avoid'][zz.quad] || '—'], ['Mapped competitors within 8 km', N(zz.comp_n8)]])}` : ''}
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sec sm" id="s7Sat">Screen in the Satchel</button><button class="btn sec sm" id="s7ToWatch">Track in Competitor Watch</button></div>`;
      $('#s7Sat', root).onclick = () => goModule('satchel', { target: l.name, domain: l.domain, posture: l.tier === 'integrity' ? 'self' : 'comp' });
      $('#s7ToWatch', root).onclick = () => goModule('watch', { comp: st.sel });
    }
    function table(vis) {
      const rows = (vis || COMP.map((l, i) => ({ l, i })).filter(x => passes(x.l))).map(x => ({ ...x.l, _i: x.i }));
      dataTable($('#s7Tbl', root), [{ k: 'name', h: 'Company', l: 1 }, { k: 'city', h: 'City', l: 1 }, { k: 'tier', h: 'Tier', l: 1 }, { k: 'rating', h: 'Rating', f: v => D(v, 1) }, { k: 'reviews', h: 'Reviews', f: v => N(v) }, { k: 'domain', h: 'Domain', l: 1 }, { k: 'dr', h: 'DR', f: v => D(v, 0) }, { k: 'org_kw', h: 'Org KW', f: v => N(v) }, { k: 'org_traffic', h: 'Org visits/mo', f: v => N(v) }, { k: 'paid_kw', h: 'Paid KW', f: v => N(v) }, { k: 'phone', h: 'Phone', l: 1 }], rows, { sortKey: 'reviews', id: r => r._i, onClick: i => { st.sel = +i; toggleView('map'); draw(); }, rowClass: r => r.tier === 'integrity' ? 'bench' : '' });
    }
    function toggleView(v) { st.view = v || (st.view === 'map' ? 'table' : 'map'); $('#s7MapView', root).hidden = st.view !== 'map'; $('#s7TblView', root).hidden = st.view !== 'table'; $('#s7View', root).textContent = st.view === 'map' ? 'Table view' : 'Map view'; if (st.view === 'table') table(); else setTimeout(() => map.apply(), 30); }
    // CBP decade chart by county
    const zc = {}; CO.forEach(c => zc[c.fips] = c);
    barChart($('#s7Cbp', root), { cats: CO.map(c => c.name), series: [{ name: '2016', color: cssv('--s1'), values: CO.map(c => c.est16 / c.occ * 1e4) }, { name: '2023', color: cssv('--heat'), values: CO.map(c => c.est23 / c.occ * 1e4) }], H: 260, fmt: v => D(v, 1), rot: true });
    $('#s7CbpN', root).innerHTML = legendRow([{ name: '2016', color: cssv('--s1'), sq: true }, { name: '2023', color: cssv('--heat'), sq: true }]) + `Establishments grew ${S((META.cbp.e23 / META.cbp.e16 - 1) * 100, 0)}% while households grew faster in the outer counties, so density rose in the core and thinned at the edge. Counts exclude the self-employed and include plumbers; treat the level with care and the change with more confidence.`;
    dataTable($('#s7Tdlr', root), [{ k: 'name', h: 'County', l: 1 }, { k: 'lic_con', h: 'Contractors', f: v => N(v) }, { k: 'lic_tech', h: 'Techs', f: v => N(v) }, { k: 'lic_cert', h: 'Certified', f: v => N(v) }, { k: 'techPerCon', h: 'Techs/contractor', v: c => c.lic_tech / c.lic_con, f: v => D(v, 1) }, { k: 'sys_per_tech', h: 'Systems/tech', f: v => N(v) }, { k: 'rep', h: 'Repl. 2026', f: v => N(v) }, { k: 'repPerTech', h: 'Repl./tech', v: c => c.rep / c.lic_tech, f: v => D(v, 1) }], CO, { sortKey: 'sys_per_tech' });
    const tt = CO.slice().sort((a, b) => b.sys_per_tech - a.sys_per_tech);
    $('#s7TdlrN', root).innerHTML = `${esc(tt[0].name)} has the thinnest licensed workforce for its installed base (${N(tt[0].sys_per_tech)} systems per technician), ${esc(tt[tt.length - 1].name)} the deepest (${N(tt[tt.length - 1].sys_per_tech)}). Where replacements per technician run high, a recruiting campaign (Campaign Desk, recruiting line) competes hardest; licenses are counted by business county, so suburban shops that work the core inflate the suburbs.`;
    // focus model comparison
    const fc = HM.cities; const cityRep = {}; CITIES.forEach(c => cityRep[c.name.toLowerCase()] = c);
    const pairs = fc.map(c => ({ c, x: cityRep[c.city.toLowerCase()] })).filter(p => p.x);
    const r1 = pearson(pairs.map(p => p.c.focus), pairs.map(p => p.x.opp_usd)), r2 = pearson(pairs.map(p => p.c.demand_idx), pairs.map(p => p.x.rep));
    $('#s7Focus', root).innerHTML = `<p class="body">The heatmap scored 80 cities on a breakdown-risk demand model (modeled housing units times a risk multiplier from aging stock, the builder boom, heat island, deferral and growth, net of competitive saturation). Rolled up to the ${pairs.length} cities both models share, its demand score correlates r = ${D(r2, 2)} with this atlas's modeled replacements and its FOCUS score r = ${D(r1, 2)} with the job value pool. The two agree on scale; this atlas replaces the modeled housing counts with ACS counts and the multiplier with calibrated lifetimes, and resolves to 263 ZIPs.</p>
      <div class="tscroll short"><table><thead><tr><th class="l">City</th><th>FOCUS (heatmap)</th><th>Demand (heatmap)</th><th>Saturation</th><th>Replacements 2026 (atlas)</th><th>Value pool (atlas)</th></tr></thead><tbody>${pairs.sort((a, b) => b.c.focus - a.c.focus).map(p => `<tr><td class="l">${esc(p.c.city)}</td><td>${p.c.focus}</td><td>${p.c.demand_idx}</td><td>${p.c.supply_idx}</td><td>${N(p.x.rep)}</td><td>${MM(p.x.opp_usd)}</td></tr>`).join('')}</tbody></table></div>`;
    $('#s7Read', root).innerHTML = [
      `<b>Reviews are the moat.</b> The top deep-dive companies hold thousands of Google reviews each; the benchmark's ${N(BENCH ? BENCH.reviews : 0)} rank #${revRank}. Review velocity, not domain rating, decides the Local Pack inside 8 km.`,
      `<b>Most rivals do not buy search.</b> ${N(top.filter(l => (l.paid_kw || 0) > 0).length)} of ${top.length} deep-dive companies showed paid keywords in Ahrefs; LSA spend is invisible to that measure, so assume the Local Services slots are contested.`,
      `<b>Licensed labor is the constraint in the exurbs.</b> Counties with the most systems per technician are where response time sells and where a recruiting line pays back.`,
      `<b>Deserts are roster gaps.</b> ZIPs with no mapped competitor within 8 km (module 06) are where a service radius expansion meets the least review mass.`,
      `<b>Screen before you copy.</b> Any competitor's ad or page can go through the Emergency Satchel; its findings are intelligence first and a report only when the evidentiary bar is met.`
    ].map(x => `<li>${x}</li>`).join('');
    $('#s7Judg', root).innerHTML = judgList([['Locations, not companies', 'Multi-location brands appear once per location on the map and once per company in the rankings (reviews summed).'], ['ZIP centroids', `${COMP.filter(l => l.geo_src === 'zip').length} of ${COMP.length} locations are placed at their ZIP centroid, not the street address; pins sit at the right ZIP, not the right block.`], ['The benchmark stays the benchmark', 'Integrity Air Conditioning is carried as the benchmark client from the heatmap; it is excluded from competition measures elsewhere.'], ['License subtypes', 'Class A licenses have subtypes starting with A (AC, AE, AR and combinations); Class B with B.']]);
    $('#s7Src', root).innerHTML = srcRows([['Competitors', 'DFW HVAC Competitive Heatmap (Top Shelf Logic), August 18, 2026: Google Business Profile via public listings and directories; Ahrefs API (DR, organic keywords, paid search); company websites', 'C', 'Aug 2026', ''], ['Licenses', 'TDLR All Licenses (7358-krk7), Texas Open Data Portal', 'A', 'Sep 25, 2026', 'https://data.texas.gov/resource/7358-krk7'], ['Establishments', 'ZIP Code Business Patterns 2016, 2023', 'B', '2023', 'https://www2.census.gov/programs-surveys/cbp/datasets/'], ['City focus model', 'Heatmap breakdown-risk demand model (80 cities)', 'D', 'Aug 2026', '']]);
    // wiring
    wireSeg($('#s7Sort', root), v => { st.sort = v; ranks(); });
    $('#s7Q', root).addEventListener('input', debounce(e => { st.q = e.target.value.trim().toLowerCase(); draw(); }, 200));
    $('#s7City', root).onchange = e => { st.city = e.target.value; draw(); };
    $$('[data-t]', root).forEach(c => c.onchange = () => { st.tiers[c.dataset.t] = c.checked; draw(); });
    $('#s7Min', root).addEventListener('input', e => { st.minrev = +e.target.value; $('#s7MinV', root).textContent = st.minrev; draw(); });
    $('#s7Base', root).onchange = e => { st.base = e.target.value; draw(); };
    $('#s7View', root).onclick = () => toggleView();
    $('#s7Watch', root).onclick = () => goModule('watch', st.sel != null ? { comp: st.sel } : {});
    $('#s7Csv', root).onclick = () => { const k = ['name', 'tier', 'domain', 'city', 'zip', 'street', 'phone', 'rating', 'reviews', 'dr', 'org_kw', 'org_traffic', 'paid_kw', 'scope', 'founded', 'lat', 'lon']; saveFile('dfw-hvac-competitors.csv', toCSV(k, COMP.map(l => k.map(x => l[x])), 'Heatmap roster, August 18, 2026. Ahrefs paid data excludes Google Local Services Ads.')); };
    BUS.on('theme', draw);
    this.receive = p => { if (p && isN(p.comp)) { st.sel = +p.comp; toggleView('map'); draw(); } };
    draw();
  }
});
