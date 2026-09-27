/* ==== m04_drivers ==== */
"use strict";
/* ============================ Module 4: Demand Drivers ============================ */
registerModule({
  key: 'drivers', num: '04', title: 'Demand Drivers', desc: 'What moves HVAC work: heat, freezes, age, income, and the permit gap',
  mount(root) {
    const TS = DATA.ts, H = META.heat, DR = DATA.drivers, SP = DATA.spatial, RF = DATA.recs, WBa = META.weib_all;
    const fw = H['Fort Worth'], da = H.Dallas, ir = H.Irving;
    const pct = b => (Math.exp(b) - 1) * 100;
    root.innerHTML = mastHTML({ eyebrow: 'Module 04 · Demand Drivers', title: 'Demand Drivers', dek: 'What actually moves heating and cooling work in Dallas Fort Worth, measured rather than asserted: how much a hot month lifts changeouts in two cities\' permit files, whether freezes do the same, how long Texas equipment lasts before it is replaced, which neighborhoods pull permits and which do not, and how the 57 breakdown predictors from the original heatmap line up behind them.',
      meta: [`<b>${N(fw.n)}</b> months of Fort Worth permits · <b>${N(da.n)}</b> of Dallas · <b>${N(ir.n)}</b> of Irving`, `<b>${N(DR.obs_per1k.n)}</b> city ZIP portions in the permit models`, `<b>${N(RF.AC_TX.n)}</b> Texas RECS households in the lifetime fit`, '<b>Errors</b> HAC and HC3 robust'],
      bar: 'Demand Drivers', barsub: 'Time series, cross section, lifetimes and space', actions: [{ id: 'd4Csv', label: '↓ Monthly series CSV' }, { id: 'd4Vars', label: '↓ 57 predictors CSV' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: three findings that should change a media plan', `<b>One.</b> Heat moves changeouts in the month it arrives. With month and year held fixed, a month 100 cooling degree days hotter than normal lifts Fort Worth's permitted changeouts ${D(pct(fw.b_cdd100), 1)}% (standard error ${D(fw.se_cdd100 * 100, 1)}, p ${fw.p_cdd < 0.001 ? '< 0.001' : '= ' + D(fw.p_cdd, 3)}) and Dallas's ${D(pct(da.b_cdd100), 1)}%. Each extra 100°F day in a month adds ${D(pct(fw.b_d100), 2)}% in Fort Worth and ${D(pct(da.b_d100), 2)}% in Dallas. Budget should follow the thermometer, not the calendar. <b>Two.</b> Freezes move repairs, not replacements: freeze days show no effect on Fort Worth's permits (p = ${D(fw.p_fr20, 2)}), though Irving's shorter file, which spans the January 2024 cold snap, shows ${D(pct(ir.b_fr20), 1)}% per day below 20°F. <b>Three.</b> The permit file is an income map. For the same modeled replacements, a ZIP with 10% higher median income records about ${D(META.cap_elast.b * 10, 0)}% more permits (elasticity ${D(META.cap_elast.b, 2)}, SE ${D(META.cap_elast.se, 2)}), and Spanish-speaking neighborhoods record fewer. Anyone targeting from permit data alone is targeting affluent compliance, not demand.`)}
      <div class="kpis" id="d4Kpis"></div>
      ${card('Heat and changeouts, Fort Worth, 2012 to 2026', 'Standalone mechanical permits a month (top) against days at 100°F or above at DFW Airport (bottom). Same months on both axes.', '<div id="d4Ts"></div><div id="d4Ts2"></div><p class="chartnote" id="d4TsN"></p>', 'mt')}
      <div class="split">
        ${card('The heat elasticity, three cities', 'Log of monthly permits on weather, with month fixed effects (and year fixed effects in Fort Worth). Coefficients converted to percent. HAC standard errors, three lags.', '<div id="d4El"></div>')}
        ${card('Equipment lifetimes, Texas', 'Survival curves from the renewal-process fits to RECS 2020 Texas. Share of systems still in service by age.', '<div id="d4SurvLeg"></div><div id="d4Surv"></div><p class="chartnote" id="d4SurvN"></p>')}
      </div>
      <div class="split">
        ${card('What predicts observed permits', `${N(DR.obs_per1k.n)} city portions of ZIPs (Dallas, Fort Worth, Irving; at least 85% inside the city). Standardized coefficients with city fixed effects; HC3 errors. R² ${D(DR.obs_per1k.r2, 2)} (city effects alone ${D(DR.obs_per1k.r2_fe_only, 2)}).`, '<div id="d4C1"></div>')}
        ${card('What predicts permit capture', `Log of observed permits over modeled replacements. Same sample and controls. R² ${D(DR.lcap.r2, 2)} (city effects alone ${D(DR.lcap.r2_fe_only, 2)}).`, '<div id="d4C2"></div>')}
      </div>
      <div class="split">
        ${card('The income gradient in permit capture', 'Each point is a city portion of a ZIP. Capture is observed permits over modeled replacements.', '<div id="d4Cap"></div><p class="chartnote" id="d4CapN"></p>')}
        ${card('Space: the map is clustered', 'Global Moran\'s I on 263 ZIPs, queen contiguity, 999 permutations; local clusters (LISA) at p below 0.05 with 499 conditional permutations.', '<div class="ctl" style="margin-bottom:8px"><select id="d4Lisa"><option value="idx">Thermal Debt Index</option><option value="ge15_sh">Systems 15+ years</option><option value="origwin_sh">Builder wave</option><option value="rep_per1k">Replacement rate</option><option value="furn20_sh">Furnaces 20+ years</option><option value="hail1_8km">Hail exposure</option><option value="oppb">Paid opportunity</option><option value="r22_sh">R22 era share</option><option value="hp_sh">Heat pump share</option></select></div><div id="d4LMap"></div><div class="legend" id="d4LLeg"></div><div id="d4Moran" style="margin-top:10px"></div>')}
      </div>
      ${card('The 57 breakdown predictors', 'The North Texas variable matrix carried from the original heatmap, with the strength and evidence tier its authors assigned. Filter to see which ones this atlas measures.', '<div class="controls" style="margin-top:0"><div class="ctl" style="flex:1 1 220px"><label class="fl" for="d4Q">Search</label><input type="search" id="d4Q" placeholder="hail, capacitor, duct..."></div><div class="ctl"><label class="fl" for="d4Cat">Category</label><select id="d4Cat"><option value="">All</option></select></div><div class="ctl"><label class="fl" for="d4Str">Strength</label><select id="d4Str"><option value="">Any</option><option value="Strong">Strong</option><option value="Moderate">Moderate</option><option value="Weak">Weak</option></select></div><label class="chk"><input type="checkbox" id="d4Meas"> measured in this atlas</label></div><div class="tscroll" id="d4Vt" style="margin-top:10px"></div>', 'mt')}
      <div class="split">
        ${card('What this means for an HVAC marketer', 'Six readings, each tied to a coefficient above.', '<ol class="meth" id="d4Mean"></ol>')}
        ${card('Data integrity: problems found in the public files and how each was handled', '', '<div id="d4Int"></div>')}
      </div>
      <div class="split">${card('Judgment calls', '', '<div id="d4Judg"></div>')}${card('Source register', '', '<div id="d4Src"></div>')}</div>
      <div class="foot">DFW Thermal Debt Atlas, module 04. Associations in observational data. The time-series effects are identified from within-month-of-year variation in weather and are the most causal thing on this page; the cross-sectional models describe who pulls permits, not why.</div></div>`;
    $('#d4Kpis', root).innerHTML = kpiHTML([
      { l: 'Hot month effect, Fort Worth', g: 'A/B', v: S(pct(fw.b_cdd100), 1) + '%', d: 'per 100 cooling degree days above normal' },
      { l: 'Hot month effect, Dallas', g: 'A/B', v: S(pct(da.b_cdd100), 1) + '%', d: `${N(da.n)} months, 2018 to 2020` },
      { l: 'Per 100°F day', g: 'A/B', v: S(pct(fw.b_d100), 2) + '%', d: `Fort Worth; Dallas ${S(pct(da.b_d100), 2)}%` },
      { l: 'Peak month', g: 'B', v: 'July', d: `seasonal index ${D(Math.max(...META.season_fw), 0)} against ${D(Math.min(...META.season_fw), 0)} in December` },
      { l: 'AC replacement life', g: 'B', v: D(WBa.AC_TX.mean, 1) + ' yrs', d: `mean; median ${D(WBa.AC_TX.median, 1)}; heat pump ${D(WBa.HP_TX.mean, 1)}; furnace ${D(WBa.GasFurn_TX.mean, 1)}` },
      { l: 'Capture elasticity to income', g: 'B', v: D(META.cap_elast.b, 2), d: 'log permits captured on log median income' },
    ]);
    // time series
    const fs = TS['Fort Worth'].series; const wx = TS.wx_monthly; const wmap = {}; wx.m.forEach((m, i) => wmap[m] = i);
    const xs = fs.map((r, i) => i);
    const lab = i => fs[i][0];
    lineChart($('#d4Ts', root), { series: [{ name: 'Permits a month', color: cssv('--heat'), pts: fs.map((r, i) => [i, r[1]]), width: 1.8 }], x: { ticks: fs.map((r, i) => r[0].endsWith('-01') ? i : null).filter(v => v != null), fmt: i => lab(i).slice(0, 4) }, y: { fmt: v => N(v), label: 'Permits a month' }, H: 220, tipTitle: i => lab(i), aria: 'Fort Worth monthly permits' });
    barChart($('#d4Ts2', root), { cats: fs.map(r => r[0]), series: [{ name: '100°F days', color: cssv('--s4'), values: fs.map(r => { const i = wmap[r[0]]; return i != null ? wx.d100[i] : null; }) }], H: 130, fmt: v => N(v), maxLabels: 15, yLabel: '100°F days' });
    const y26 = fs.filter(r => r[0].startsWith('2026')); const y25 = fs.filter(r => r[0].startsWith('2025'));
    $('#d4TsN', root).innerHTML = `The summer peaks line up with the heat: 2018, 2022 and 2023 were the hot summers of the file and its busiest. August and September 2026 (27 and 15 days at 100°F) produced ${N(sum(y26.filter(r => r[0] >= '2026-08').map(r => r[1])))} permits against ${N(sum(y25.filter(r => r[0] >= '2025-08' && r[0] <= '2025-09').map(r => r[1])))} in the same two months of 2025. Year effects absorb the slow drift in enforcement and housing; month effects absorb the season. What is left is weather.`;
    // elasticity table
    const row = (nm, h) => `<tr><td class="l"><b>${nm}</b><div class="mini">${N(h.n)} months</div></td><td>${S(pct(h.b_d100), 2)}%<div class="mini">SE ${D(h.se_d100 * 100, 2)} · p ${D(h.p_d100, 3)}</div></td><td>${S(pct(h.b_cdd100), 1)}%<div class="mini">SE ${D(h.se_cdd100 * 100, 1)} · p ${D(h.p_cdd, 3)}</div></td><td>${S(pct(h.b_fr20), 1)}%<div class="mini">SE ${D(h.se_fr20 * 100, 1)} · p ${D(h.p_fr20, 3)}</div></td><td>${S(pct(h.b_first), 1)}%<div class="mini">p ${D(h.p_first, 3)}</div></td></tr>`;
    $('#d4El', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">City</th><th>Per 100°F day</th><th>Per 100 CDD above normal</th><th>Per freeze day ≤20°F</th><th>First 100°F month</th></tr></thead><tbody>${row('Fort Worth', fw)}${row('Dallas', da)}${row('Irving', ir)}</tbody></table></div>
      <p class="chartnote">Fort Worth carries year effects (${N(fw.n)} months is long enough); Dallas and Irving, with under three years each, carry month effects only, so their larger heat coefficients may absorb a trend. The "first 100°F month" test asks whether the season's first heat wave does more than its degree days: the heatmap's matrix says it should (ServiceTitan: +90% revenue in the first heat wave). Fort Worth's permit file finds ${S(pct(fw.b_first), 1)}% (p ${D(fw.p_first, 2)}): the first-wave surge is real for service calls but mostly does not show up as extra replacements.</p>`;
    // survival
    const cols = [cssv('--heat'), cssv('--cool'), cssv('--s4'), cssv('--s7')];
    const keys = [['AC_TX', 'Central AC'], ['HP_TX', 'Heat pump'], ['GasFurn_TX', 'Gas furnace'], ['ElecFurn_TX', 'Electric air handler']];
    $('#d4SurvLeg', root).innerHTML = legendRow(keys.map((k, i) => ({ name: `${k[1]} (mean ${D(WBa[k[0]].mean, 1)} yrs)`, color: cols[i] })));
    lineChart($('#d4Surv', root), { series: keys.map((k, i) => ({ name: k[1], color: cols[i], pts: [...Array(31)].map((_, t) => [t, 100 * weibS(t, WBa[k[0]].lam, WBa[k[0]].k)]), fmt: v => P(v, 0) })), x: { ticks: [0, 5, 10, 15, 20, 25, 30], fmt: v => v + ' yrs' }, y: { min: 0, max: 100, fmt: v => v + '%', label: 'Still in service' }, H: 260, tipTitle: t => 'Age ' + t + ' years', aria: 'survival curves' });
    $('#d4SurvN', root).innerHTML = `Half of central air conditioners are replaced by year ${D(WBa.AC_TX.median, 1)}, half of heat pumps by ${D(WBa.HP_TX.median, 1)} (they run in winter too), half of gas furnaces by ${D(WBa.GasFurn_TX.median, 1)}. Replicate-weight standard errors on the means are small (AC ±${D(META.weib.AC_TX.se_mean, 2)} years; furnace ±${D(META.weib.GasFurn_TX.se_mean, 2)}; heat pump ±${D(META.weib.HP_TX.se_mean, 2)}); the larger uncertainty is how respondents estimate age, handled by the scenarios in module 02.`;
    // coefficient plots
    coefPlot($('#d4C1', root), DR.obs_per1k.rows); coefPlot($('#d4C2', root), DR.lcap.rows);
    // capture scatter
    const cityCol = { 'Fort Worth': cssv('--heat'), Dallas: cssv('--s1'), Irving: cssv('--s3') };
    const r = scatter($('#d4Cap', root), { pts: DR.pts.map(p => ({ x: p.inc / 1000, y: p.cap * 100, c: cityCol[p.city], tip: `<div class="tt">${p.zip} · ${p.city}</div>${tipRow('Median income', M$(p.inc))}${tipRow('Permits captured', P(p.cap * 100, 0))}${tipRow('Observed per 1,000 systems', D(p.obs, 1))}` })), x: { label: 'Median household income ($ thousands)', fmt: v => '$' + D(v, 0) + 'k' }, y: { label: 'Permits captured (% of modeled replacements)', fmt: v => D(v, 0) + '%' }, H: 320 });
    $('#d4CapN', root).innerHTML = `${legendRow([{ name: 'Fort Worth', color: cityCol['Fort Worth'], sq: true }, { name: 'Dallas', color: cityCol.Dallas, sq: true }, { name: 'Irving', color: cityCol.Irving, sq: true }])}Pearson r = ${D(r.r, 2)} across ${r.n} city portions. The lowest-income ZIPs record one permit for every seven or eight modeled changeouts; the highest-income record one for every two or three. A permit-weighted target list overweights the right side of this chart.`;
    // LISA map
    const lmap = new ZipMap($('#d4LMap', root), { onSelect: () => { }, onHover: (zip, e) => { const z = ZI[zip]; if (!z || z.occ < 200) return; const v = $('#d4Lisa', root).value; const q = z['lisa_' + v]; showTip(`<div class="tt">${z.zip} · ${esc(z.city)}</div>${tipRow('Cluster', { HH: 'Hot spot (high among high)', LL: 'Cold spot (low among low)', HL: 'High outlier', LH: 'Low outlier', ns: 'Not significant' }[q] || '—')}`, e); } });
    function drawLisa() { const v = $('#d4Lisa', root).value; const C = { HH: cssv('--heat'), LL: cssv('--cool'), HL: '#f1b48f', LH: '#9ec5f4', ns: cssv('--sunk-2') }; lmap.fill(zip => { const z = ZI[zip]; if (!z || z.occ < 200) return null; return C[z['lisa_' + v]] || null; }); const s = SP[v];
      $('#d4LLeg', root).innerHTML = `<div class="catleg">${[['HH', 'Hot spot'], ['LL', 'Cold spot'], ['HL', 'High outlier'], ['LH', 'Low outlier'], ['ns', 'Not significant']].map(([k, l]) => `<span><i style="background:${C[k]}"></i>${l} ${s ? '(' + s.counts[k] + ')' : ''}</span>`).join('')}</div>`; }
    $('#d4Lisa', root).onchange = drawLisa; drawLisa();
    const ml = { idx: 'Thermal Debt Index', ge15_sh: 'Systems 15+ years', origwin_sh: 'Builder wave', rep_per1k: 'Replacement rate', furn20_sh: 'Furnaces 20+', hail1_8km: 'Hail exposure', oppb: 'Paid opportunity', effb: 'Paid efficiency', r22_sh: 'R22 era share', hp_sh: 'Heat pump share' };
    $('#d4Moran', root).innerHTML = `<table><thead><tr><th class="l">Measure</th><th>Moran's I</th><th>p</th><th>Hot spots</th><th>Cold spots</th></tr></thead><tbody>${Object.entries(SP).map(([k, s]) => `<tr><td class="l">${ml[k] || k}</td><td>${D(s.I, 3)}</td><td>${s.p <= 0.001 ? '0.001' : D(s.p, 3)}</td><td>${s.counts.HH}</td><td>${s.counts.LL}</td></tr>`).join('')}</tbody></table><p class="chartnote">Everything clusters (expected I near zero is about ${D(SP.idx.EI, 3)}). Hail clusters hardest (I = ${D(SP.hail1_8km.I, 2)}) because storms track across whole corridors; the builder wave clusters more than age itself because subdivisions were built in phases. Clusters, not single ZIPs, are the natural unit for a radius buy.</p>`;
    // 57 vars
    const V = DATA.hm.vars; const MEAS = new Set([1, 3, 6, 9, 11, 20, 22, 25, 28, 29, 41, 44, 55]);
    $('#d4Cat', root).innerHTML += [...new Set(V.map(v => v.category))].map(c => `<option value="${esc(c)}">${esc(c.replace(/^[A-H]\.\s*/, ''))}</option>`).join('');
    function drawVars() { const q = $('#d4Q', root).value.trim().toLowerCase(), cat = $('#d4Cat', root).value, str = $('#d4Str', root).value, meas = $('#d4Meas', root).checked;
      const rows = V.filter(v => (!q || (v.variable + ' ' + (v.nt_note || '') + ' ' + (v.finding || '')).toLowerCase().includes(q)) && (!cat || v.category === cat) && (!str || (v.strength || '').includes(str)) && (!meas || MEAS.has(v.n)));
      $('#d4Vt', root).innerHTML = `<table class="prose"><thead><tr><th>#</th><th>Variable</th><th>Category</th><th>Strength</th><th>Tier</th><th>Direction</th><th>North Texas note</th><th>This atlas</th></tr></thead><tbody>${rows.map(v => `<tr><td>${v.n}</td><td>${esc(v.variable)}</td><td>${esc((v.category || '').replace(/^[A-H]\.\s*/, ''))}</td><td>${esc(v.strength || '—')}</td><td>${esc(v.tier || '—')}</td><td>${esc(v.direction || '')}</td><td>${esc(v.nt_note || '')}</td><td>${MEAS.has(v.n) ? '<span class="tag on">measured</span>' : ''}</td></tr>`).join('')}</tbody></table>`; }
    ['#d4Q', '#d4Cat', '#d4Str', '#d4Meas'].forEach(s => $(s, root).addEventListener('input', drawVars)); drawVars();
    $('#d4Mean', root).innerHTML = [
      `<b>Pace spend to the thermometer.</b> A 100 CDD hot month lifts changeouts ${D(pct(fw.b_cdd100), 0)} to ${D(pct(da.b_cdd100), 0)}%; the Campaign Desk's flighting multiplies the seasonal curve by live heat. Pre-book budget for June to August and hold 20% in reserve for heat waves.`,
      `<b>Heating is a repair market.</b> Freeze days do not move Fort Worth's replacement permits. Winter campaigns sell safety inspections, no-heat repair and heat pump defrost fixes; the replacement pitch waits for the next summer or for a cracked heat exchanger.`,
      `<b>Heat pumps turn over fastest.</b> Mean replacement life ${D(WBa.HP_TX.mean, 1)} years against ${D(WBa.AC_TX.mean, 1)} for AC; the ZIPs with high heat pump shares (east and south exurbs, all-electric subdivisions) replace sooner per system.`,
      `<b>Never target from permits alone.</b> Capture rises with income (elasticity ${D(META.cap_elast.b, 2)}) and falls with the Spanish-speaking share (β = ${D(DR.obs_per1k.rows[6].b, 2)}). The installed-base model is the demand map; permits are an audit of who pulls them.`,
      `<b>Buy clusters, not ZIPs.</b> Moran's I of ${D(SP.oppb.I, 2)} on paid opportunity means neighbors share fortunes; an 8 km radius around a hot-spot cluster beats a ZIP list for efficiency.`,
      `<b>Say "15 years" out loud.</b> Half the metro's central systems are gone by ${D(WBa.AC_TX.median, 0)}. A homeowner with a 14-year-old condenser is in the middle of the curve; the repair calculator in module 02 shows them the odds.`
    ].map(x => `<li>${x}</li>`).join('');
    $('#d4Int', root).innerHTML = proseTable([
      ['Dallas permit file is historical', 'The open-data file stops on August 29, 2020 (the city moved to Accela). Its 32 months are used for calibration and the time series, not for current levels.', 'Handled'],
      ['Fort Worth mixes residential and commercial', 'Standalone mechanical permits carry no use flag after 2014 (work descriptions blank on 97% of 2020+ rows). Compared against all modeled systems including apartments; commercial rooftop jobs inflate observed counts slightly.', 'Handled'],
      ['Irving layer is labeled "present" but ends in February 2025', 'Used for tickets and job mix over February 2022 to February 2025 only.', 'Flagged'],
      ['About 9% of permits lack a ZIP', 'Dropped from ZIP rates; kept in city totals and time series.', 'Handled'],
      ['ACS "2020 or later" ends at survey year 2024', 'Homes finished in 2025 and 2026 are absent from the stock; they carry no replacements yet.', 'Documented'],
      ['RECS ages are reported by respondents', 'Heaping at round numbers and guesses flatten the hazard. Handled by the k = 3 and k = 4 scenarios.', 'Handled'],
      ['Storm reports are not a hail census', 'Spotter density biases counts toward cities; layer graded C and halved in the index.', 'Handled'],
      ['ZCTAs are not USPS ZIPs', 'Census ZCTAs approximate ZIP delivery areas; PO box and single-building ZIPs (for example DFW Airport) carry no households and appear gray.', 'Documented'],
    ].map(r => [r[0], r[1], `<span class="pill">${r[2]}</span>`]));
    $('#d4Judg', root).innerHTML = judgList([
      ['City portions, not whole ZIPs', 'Permits exist only inside the issuing city. Each ZIP is cut to its city portion using 2020 block housing counts and kept in the regression only if at least 85% of its housing is inside.'],
      ['Standardized coefficients', 'Every predictor and the outcome are z-scored so effects compare on one scale; city fixed effects stay in every model. Shapley shares split the explained variance among predictors after the city effects.'],
      ['Monthly weather from one station', 'DFW Airport (GHCN USW00003927) stands in for the metro. Fort Worth Meacham and Dallas Love Field differ by a degree or two on hot afternoons.'],
      ['Freeze threshold of 20°F', 'Heat pumps lose capacity well above 20°F; the threshold marks the nights that break equipment, not the ones that merely strain it.'],
      ['The 57-variable matrix is inherited', 'Strength and tier labels are the heatmap authors\' own; this atlas marks which ones it measures but does not re-grade them.']]);
    $('#d4Src', root).innerHTML = srcRows([
      ['Daily temperature', 'NOAA NCEI GHCN-Daily, DFW International Airport (USW00003927)', 'A', 'through Sep 22, 2026', 'https://www.ncei.noaa.gov/pub/data/ghcn/daily/by_station/'],
      ['Fort Worth permits', 'City of Fort Worth development permits, mechanical standalone', 'B', '2012 to Sep 2026', 'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer'],
      ['Dallas permits', 'City of Dallas building permits, mechanical single family alteration', 'B', '2018 to Aug 2020', 'https://www.dallasopendata.com/resource/e7gq-4sah'],
      ['Irving permits', 'City of Irving residential permits, mechanical standalone', 'B', 'Feb 2022 to Feb 2025', 'https://services3.arcgis.com/OfsJXUlu8pSkbl7B/arcgis/rest/services/Residential_Permits_Issued_Feb_15_2022_Present/FeatureServer'],
      ['Equipment lifetimes', 'EIA RECS 2020 microdata, Texas; Fay replicate weights for standard errors', 'B', '2020', 'https://www.eia.gov/consumption/residential/data/2020/'],
      ['Breakdown predictors', 'HVAC Breakdown Variable Matrix, North Texas (carried from the DFW HVAC Competitive Heatmap)', 'B/C', 'Aug 2026', ''],
    ]);
    $('#d4Csv', root).onclick = () => { const rows = fs.map(r => { const i = wmap[r[0]]; return [r[0], r[1], i != null ? wx.d100[i] : '', i != null ? Math.round(wx.cdd[i]) : '', i != null ? Math.round(wx.hdd[i]) : '', i != null ? wx.fr20[i] : '']; }); saveFile('fort-worth-hvac-permits-and-weather-monthly.csv', toCSV(['month', 'fw_mech_permits', 'days_100F', 'cdd', 'hdd', 'days_min_20F_or_below'], rows, 'Fort Worth standalone mechanical permits (void and withdrawn excluded) and DFW Airport weather.')); };
    $('#d4Vars', root).onclick = () => saveFile('north-texas-hvac-breakdown-predictors.csv', toCSV(['n', 'variable', 'category', 'sector', 'direction', 'strength', 'finding', 'tier', 'source', 'nt_note'], V.map(v => [v.n, v.variable, v.category, v.sector, v.direction, v.strength, v.finding, v.tier, v.source, v.nt_note])));
    BUS.on('theme', () => { drawLisa(); });
  }
});
