/* ==== m01_index ==== */
"use strict";
/* ============================ shared layer catalog (modules 1, 4, 5, 6) ============================ */
const LAYERS = {
  idx: { l: 'Thermal Debt Index (percentile)', grp: 'Index', dir: 1, ramp: 'ember', g: 'B', f: v => D(v, 0), note: 'Weighted composite of seven graded components. A percentile across the 263 residential ZIPs: 100 carries the most thermal debt, not "100% of anything".' },
  idx_eq: { l: 'Thermal Debt Index, equal weights (percentile)', grp: 'Index', dir: 1, ramp: 'ember', g: 'B', f: v => D(v, 0), note: 'The same seven components with every weight set equal. The sensitivity check for the weighted index.' },
  ge15_sh: { l: 'Central systems 15 years or older (%)', grp: 'Aging fleet', dir: 1, ramp: 'ember', g: 'B', f: v => P(v), note: 'Renewal model on ACS year built, calibrated to RECS 2020 Texas equipment ages. Past the fitted median replacement life of 14.9 years.' },
  ge20_sh: { l: 'Central systems 20 years or older (%)', grp: 'Aging fleet', dir: 1, ramp: 'ember', g: 'B', f: v => P(v), note: 'Systems running on borrowed time; most carry R22 and a coil that no longer matches any new condenser.' },
  rep_per1k: { l: 'Expected system replacements per 1,000 households, 2026', grp: 'Aging fleet', dir: 1, ramp: 'ember', g: 'B', f: v => D(v, 1), note: 'Expected renewals in the next twelve months from the fitted Weibull lifetimes, summed over every household and multi-system home.' },
  origwin_sh: { l: 'Original builder systems aged 10 to 25 (%)', grp: 'Aging fleet', dir: 1, ramp: 'ember', g: 'B', f: v => P(v), note: 'Systems still original to the house, in homes old enough to be in the first failure window. The first replacement is the one no contractor owns yet.' },
  orig_sh: { l: 'Original systems still running, any age (%)', grp: 'Aging fleet', dir: 1, ramp: 'ember', g: 'B', f: v => P(v), note: 'Share of central systems never replaced since the house was built.' },
  first5_per1k: { l: 'First replacements due 2026 to 2030 per 1,000 households', grp: 'Aging fleet', dir: 1, ramp: 'ember', g: 'B', f: v => D(v, 1), note: 'Original systems the model expects to fail or be replaced in the next five years.' },
  r22_sh: { l: 'R22 era systems still running, installed before 2010 (%)', grp: 'Aging fleet', dir: 1, ramp: 'ember', g: 'B', f: v => P(v), note: 'New R22 equipment was banned from 1 January 2010 and R22 production ended in 2020; any leak on these is a replacement conversation.' },
  furn20_sh: { l: 'Gas furnaces 20 years or older (%)', grp: 'Aging fleet', dir: 1, ramp: 'ember', g: 'B', f: v => P(v), note: 'Share of gas furnaces past 20 years (heat exchanger and flame safety age). Fitted furnace mean life 18.2 years (RECS 2020 Texas).' },
  meanage: { l: 'Mean central system age (years)', grp: 'Aging fleet', dir: 1, ramp: 'ember', g: 'B', f: v => D(v, 1) + ' yr', note: 'Model estimate of the average age of the installed cooling system.' },
  medyr: { l: 'Median year built (ACS)', grp: 'Housing stock', dir: -1, ramp: 'ember', g: 'A', f: v => D(v, 0), note: 'ACS 2020 to 2024 five-year, table B25035. Older stock shades darker.' },
  yb_pre1980: { l: 'Homes built before 1980 (%)', grp: 'Housing stock', dir: 1, ramp: 'ember', g: 'A', f: v => P(v), note: 'ACS B25034. Retrofit central air, undersized ducts, electrical panels that limit heat pump options.' },
  yb_duct: { l: 'Homes built 1980 to 1999 (%)', grp: 'Housing stock', dir: 1, ramp: 'ember', g: 'A', f: v => P(v), note: 'The flex duct generation, now 27 to 46 years old in 140 degree attics. The reinstall cohort.' },
  yb_2000_09: { l: 'Homes built 2000 to 2009 (%)', grp: 'Housing stock', dir: 1, ramp: 'ember', g: 'A', f: v => P(v), note: `The first DFW builder boom (${N(BOOM1)} single-family permits 2000 to 2006), now 17 to 26 years old.` },
  yb_2010_19: { l: 'Homes built 2010 to 2019 (%)', grp: 'Housing stock', dir: 1, ramp: 'blue', g: 'A', f: v => P(v), note: 'The second wave. Original systems entering the failure window now.' },
  yb_2020p: { l: 'Homes built 2020 or later (%)', grp: 'Housing stock', dir: 1, ramp: 'blue', g: 'A', f: v => P(v), note: 'Warranty territory; maintenance plans, not replacements.' },
  own_sf_sh: { l: 'Owner occupied single-family homes (% of households)', grp: 'Housing stock', dir: 1, ramp: 'teal', g: 'A', f: v => P(v), note: 'ACS B25032. The household that signs for its own replacement.' },
  rent_sf_sh: { l: 'Single-family homes that are rented (%)', grp: 'Housing stock', dir: 1, ramp: 'teal', g: 'A', f: v => P(v), note: 'ACS B25032. Landlord and institutional single-family rental decisions; a B2B channel, not a consumer ad.' },
  mf_sh: { l: 'Units in buildings of 2 or more (%)', grp: 'Housing stock', dir: 1, ramp: 'teal', g: 'A', f: v => P(v), note: 'ACS B25024. Apartment systems are bought by property managers.' },
  gas_sh: { l: 'Homes heated with gas (%)', grp: 'Heating', dir: 1, ramp: 'ember', g: 'A', f: v => P(v), note: 'ACS B25040, utility plus bottled gas. The furnace market.' },
  elec_sh: { l: 'Homes heated with electricity (%)', grp: 'Heating', dir: 1, ramp: 'blue', g: 'A', f: v => P(v), note: 'ACS B25040. Heat pumps and electric air handlers with strip heat.' },
  hp_sh: { l: 'Heat pump share of central systems (%, model)', grp: 'Heating', dir: 1, ramp: 'blue', g: 'B', f: v => P(v), note: 'Electric-heated share times the RECS 2020 Texas heat pump share among central electric systems (47% single family, 53% multifamily).' },
  hail1_8km: { l: 'Hail 1 inch or larger, reports within 8 km per decade', grp: 'Exposure', dir: 1, ramp: 'ember', g: 'C', f: v => D(v, 1), note: 'NOAA Storm Events 2016 to 2026. Reports follow people and spotters, so dense areas over-report.' },
  hail175_8km: { l: 'Hail 1.75 inches or larger, reports within 8 km per decade', grp: 'Exposure', dir: 1, ramp: 'ember', g: 'C', f: v => D(v, 1), note: 'Golf ball and larger: the size that crushes condenser fins and triggers insurance replacements.' },
  hail_recent: { l: 'Large hail reports within 8 km, 2023 to 2026', grp: 'Exposure', dir: 1, ramp: 'ember', g: 'C', f: v => D(v, 0), note: 'Recent 1.75 inch and larger reports. Claims from these storms are still being settled.' },
  sys_per_est8: { l: 'Systems per HVAC contractor establishment within 8 km', grp: 'Supply', dir: 1, ramp: 'blue', g: 'C', f: v => N(v), note: 'County Business Patterns 2023, NAICS 238220 (plumbing, heating and air conditioning contractors) within 8 km. Higher means thinner local supply.' },
  comp_mass: { l: 'Competitor review mass nearby (proximity weighted)', grp: 'Supply', dir: 1, ramp: 'blue', g: 'C', f: v => N(v), note: 'Google reviews of the 241 mapped competitor locations, weighted by exp(minus distance over 12 km). A Local Pack pressure proxy.' },
  est23: { l: 'HVAC and plumbing establishments in the ZIP, 2023', grp: 'Supply', dir: 1, ramp: 'blue', g: 'B', f: v => N(v), note: 'County Business Patterns, ZIP Code Business Patterns 2023, NAICS 238220.' },
  value: { l: 'Median home value ($)', grp: 'Context', dir: 1, ramp: 'teal', g: 'A', f: v => M$(v), note: 'ACS B25077.' },
  inc: { l: 'Median household income ($)', grp: 'Context', dir: 1, ramp: 'teal', g: 'A', f: v => M$(v), note: 'ACS B19013.' },
  rooms: { l: 'Median rooms per home', grp: 'Context', dir: 1, ramp: 'teal', g: 'A', f: v => D(v, 1), note: 'ACS B25018. A tonnage proxy.' },
  own65_sh: { l: 'Owners aged 65 and over (% of owners)', grp: 'Context', dir: 1, ramp: 'teal', g: 'A', f: v => P(v), note: 'ACS B25007. Maintenance plan buyers, heat vulnerable.' },
  own_recent_sh: { l: 'Owners who moved in 2020 or later (% of owners)', grp: 'Context', dir: 1, ramp: 'teal', g: 'A', f: v => P(v), note: 'ACS B25038. New owners inherit old systems and have no contractor yet.' },
  span_sh: { l: 'Spanish-speaking households (%)', grp: 'Context', dir: 1, ramp: 'teal', g: 'A', f: v => P(v), note: 'ACS C16002. Sets the Spanish build in the Campaign Desk and Site Forge.' },
  density: { l: 'Housing units per square mile', grp: 'Context', dir: 1, ramp: 'teal', g: 'A', f: v => N(v), note: 'ACS units over Gazetteer land area.' },
};
const LAYER_GROUPS = ['Index', 'Aging fleet', 'Housing stock', 'Heating', 'Exposure', 'Supply', 'Context'];
Object.assign(LAYERS, SLM.layers()); LAYER_GROUPS.push('Campaign levers', 'Service line priority');   /* module 12's layers join the shared catalog */
function layerOptions(keys, sel) { const groups = [...new Set(keys.map(k => (LAYERS[k] || {}).grp || 'Model'))]; return groups.map(g => `<optgroup label="${g}">${keys.filter(k => ((LAYERS[k] || {}).grp || 'Model') === g).map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc((LAYERS[k] || {}).l || k)}</option>`).join('')}</optgroup>`).join(''); }
const COMP_KEYS = [['aged', 'Systems 15 years or older'], ['rate', 'Replacement rate'], ['wave', 'Builder wave'], ['furn', 'Furnaces 20 years or older'], ['hail', 'Hail exposure'], ['duct', 'Duct generation'], ['supply', 'Contractor supply gap']];
function zipTip(z, lay) {
  const L = LAYERS[lay] || {}; const v = z[lay];
  return `<div class="tt">${esc(z.zip)} · ${esc(z.city)}</div><div class="ts">${esc(z.cty)} County · ${N(z.occ)} households</div>` +
    (lay !== 'idx' ? tipRow(esc((L.l || lay).replace(/\s*\(.*\)$/, '')), L.f ? L.f(v) : D(v, 1)) : '') +
    tipRow('Thermal Debt Index', isN(z.idx) ? D(z.idx, 0) + 'th pct.' : '—') + tipRow('Systems 15+ years', P(z.ge15_sh)) + tipRow('Replacements due 2026', N(z.rep)) + tipRow('Median year built', D(z.medyr, 0)) + tipRow('Gas heat', P(z.gas_sh, 0)) +
    `<div class="tf">Click for the full ledger</div>`;
}
/* ============================ Module 1: Thermal Debt Index ============================ */
registerModule({
  key: 'index', num: '01', title: 'Thermal Debt Index', desc: 'Where aging heating and cooling systems are coming due, ZIP by ZIP',
  mount(root) {
    const st = { layer: 'idx', sel: null, county: '', comp: false, sortK: 'idx', sortDir: -1 };
    const W = DATA.index.W, R = DATA.index.reach; const Wsum = sum(Object.values(W));
    const tops = ZR.slice().sort((a, b) => b.idx - a.idx); const most = tops[0], least = tops[tops.length - 1];
    root.innerHTML = mastHTML({ eyebrow: 'Module 01 · Thermal Debt Index · Dallas Fort Worth, 12 counties', title: 'Thermal Debt Index', dek: 'Every heating and cooling system in Dallas Fort Worth was installed on a date, and every one of them is aging toward a replacement. This module estimates where that debt is largest: how many systems are past their fitted life, how many are still the builder\'s original, how many still run on R22, how many furnaces are over twenty, and where hail and thin contractor supply add to it. Mapped to the 263 residential ZIP codes of the metroplex.',
      meta: [`<b>Coverage</b> ${N(META.nzip)} ZIPs · 12 counties · ${N(META.occ)} households`, `<b>Installed base</b> ${N(META.sys)} central systems (est.)`, '<b>Confidence</b> every layer graded A to D', '<b>Compiled</b> September 25, 2026 · <b>Build 2</b> September 26, 2026 (service lines, competitor watch)'],
      bar: 'Thermal Debt Index', barsub: 'Seven graded components · 263 residential ZIPs · works offline',
      actions: [{ id: 'i1Csv', label: '↓ ZIP CSV' }, { id: 'i1Rep', label: 'Replacement Wave ↗', title: 'Open the selected ZIP in the Replacement Wave tab' }, { id: 'i1Desk', label: 'Campaign Desk ↗', title: 'Send the top ZIPs in view to the Campaign Desk' }, { id: 'i1Forge', label: 'Site Forge ↗', title: 'Send the top ZIPs in view to the Site Forge' }, { id: 'i1Lines', label: 'Service Lines ↗', title: 'Open the selected ZIP in the Service Lines ledger (module 12)' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: what the index is and is not', `This maps <b>aging equipment, not service calls</b>. No agency counts HVAC replacements. What can be measured is the stock the equipment sits in: when each home was built (Census ACS), how it is heated, who owns it, and how long Texas systems actually last before they are replaced (EIA RECS 2020, ${N(META.weib.AC_TX.n)} Texas households with central air). Combining them gives a <b>modeled installed base</b> of ${N(META.sys)} central systems with an age for each one. A high index is a ZIP where more of that base is old, original, R22 era or hail exposed, and where fewer contractors are nearby. It is not a claim about any one house, and it is not a media plan: <b>module 05</b> converts debt into reachable, payable jobs, <b>module 12</b> splits those jobs into fourteen service lines with their own seasons, tickets and bid modifiers, and <b>module 13</b> watches what the competitors are advertising. The maps disagree where money and competition say they should.`)}
      <div class="kpis" id="i1Kpis"></div>
      <div class="controls">
        <div class="ctl" style="flex:1 1 320px"><label class="fl" for="i1Layer">Map layer</label><select id="i1Layer">${layerOptions(Object.keys(LAYERS), 'idx')}</select></div>
        <div class="ctl"><label class="fl" for="i1Cty">County</label><select id="i1Cty"><option value="">All 12 counties</option>${CO.map(c => `<option value="${c.fips}">${c.name}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="i1Find">Find a ZIP or city</label><input type="search" id="i1Find" placeholder="75150 or Mesquite" autocomplete="off"></div>
        <label class="chk"><input type="checkbox" id="i1Comp"> Show the 242 mapped competitors</label>
      </div>
      <div class="grid2">
        <div class="card mapcard"><div id="i1Map"></div><div class="legend" id="i1Leg"></div></div>
        <div class="stack">
          <div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3 id="i1Name">All 263 residential ZIPs</h3><p id="i1Sub">Click any ZIP on the map or a row in the ranking</p></div><span class="pill" id="i1Pill">Metro</span></div><div class="card-b" id="i1Detail"></div></div>
          <div class="card"><div class="card-h"><h3>Ranking: <span id="i1TblName"></span></h3><p>Click a row to select it. Click a header to sort.</p></div><div class="tscroll short" id="i1Tbl"></div></div>
        </div>
      </div>
      <div class="split">
        ${card('How the index is built', 'Seven components, each oriented so a higher value means more debt. Every weight is reach times tier, and every number in the chain is shown.', '<div id="i1Method"></div>')}
        ${card('Is this one variable or seven?', 'Pearson correlations between the standardized components across 263 ZIPs, with the weighted against equal-weight sensitivity check.', '<div id="i1Cohere"></div>')}
      </div>
      ${card('Does the index predict anything it was not built from?', 'Observed HVAC mechanical permits from three city permit files, per 1,000 modeled systems in the part of each ZIP inside the city. ZIPs at least 85% inside the city by 2020 housing units. None of these were inputs.', `<div class="split" style="margin-top:0"><div><div id="i1Sc1"></div><p class="chartnote" id="i1Sc1n"></p></div><div><div id="i1Sc2"></div><p class="chartnote" id="i1Sc2n"></p></div></div><div id="i1Val"></div>`, 'mt')}
      <div class="split">
        ${card('Caveats: the fine print', 'Eight things that would change a conclusion drawn from this map.', '<div id="i1Cav"></div>')}
        ${card('What this atlas cannot show', 'Documented gaps. Each says why, so the next request goes to the right custodian.', '<div id="i1Gap"></div>')}
      </div>
      ${card('Source register', 'Every layer traced to the dataset it came from, with the confidence grade applied to that layer.', '<div id="i1Src"></div>', 'mt')}
      <div class="foot" id="i1Foot"></div></div>`;
    // KPIs
    $('#i1Kpis', root).innerHTML = kpiHTML([
      { l: 'Central systems (est.)', g: 'B', v: K(META.sys), d: `${N(META.sys_ownsf)} in owner-occupied single-family homes` },
      { l: 'Past 15 years', g: 'B', v: P(META.ge15 / META.sys * 100, 1), d: `${N(META.ge15)} systems; ${N(META.ge20)} are past 20` },
      { l: 'Still the original', g: 'B', v: K(META.orig), d: `${N(META.orig_win)} of them in homes aged 10 to 25` },
      { l: 'R22 era, still running', g: 'B', v: K(META.r22), d: 'installed before the 2010 equipment ban' },
      { l: 'Replacements due, 2026', g: 'B', v: K(META.rep), d: `${P(META.rep / META.sys * 100, 1)} of the installed base in twelve months` },
      { l: 'Gas furnaces past 20', g: 'B', v: K(META.furn20), d: `of ${N(META.furn)} gas furnaces` },
      { l: 'Most debt', g: 'Index', v: esc(most.zip), d: `${esc(most.city)} · ${P(most.ge15_sh, 0)} of systems 15+ years` },
    ].map(k => k.g === 'Index' ? { ...k, g: '' } : k));
    // map
    const map = new ZipMap($('#i1Map', root), { onSelect: z => select(z), onHover: (z, e) => { const r = ZI[z]; if (r) showTip(zipTip(r, st.layer), e); }, onPin: id => { goModule('supply', { comp: +id }); }, onPinHover: (id, e) => { const l = COMP[+id]; showTip(`<div class="tt">${esc(l.name)}</div><div class="ts">${esc(l.city)} · ${l.rating || '—'}★ · ${N(l.reviews)} reviews</div><div class="tf">Click to open in Supply Line</div>`, e); } });
    function curVals() { return ZR.filter(z => !st.county || z.fips === st.county).map(z => z[st.layer]); }
    function render() {
      const L = LAYERS[st.layer]; const vals = ZR.map(z => z[st.layer]); const sc = qScale(vals, L.ramp, L.dir);
      map.fill(zip => { const z = ZI[zip]; if (!z || z.occ < 200) return null; return sc.f(z[st.layer]); });
      map.dim(st.county ? new Set(Z.filter(z => z.fips === st.county).map(z => z.zip)) : null);
      map.select(st.sel);
      map.pins(st.comp ? COMP.map((l, i) => ({ id: i, lat: l.lat, lon: l.lon, r: l.tier === 'bench' ? 7.5 : l.tier === 'top40' ? 4.2 + Math.log10((l.reviews || 0) + 1) : 2.6, fill: l.tier === 'bench' ? cssv('--bench') : l.tier === 'top40' ? cssv('--s1') : cssv('--ink-3'), shape: l.tier === 'bench' ? 'diamond' : '', op: l.tier === 'roster' ? .6 : .9 })) : []);
      const v = vals.filter(isN);
      $('#i1Leg', root).innerHTML = legendHTML({ title: L.l, R: sc.R, lo: L.f(Math.min(...v)), hi: L.f(Math.max(...v)), note: `<b>${L.dir === -1 ? 'Lower values shade darker' : 'Higher values shade darker'}</b> ${L.dir === -1 ? '(older stock reads as more debt). ' : '. '}Eight quantile classes across 263 residential ZIPs; gray means no resident households. ${G(L.g)}<br>${esc(L.note)}` });
      drawTable(); drawDetail();
    }
    function drawTable() {
      const L = LAYERS[st.layer]; $('#i1TblName', root).textContent = L.l;
      const rows = ZR.filter(z => !st.county || z.fips === st.county);
      const k2 = st.layer === 'idx' ? 'ge15_sh' : st.layer; const L2 = LAYERS[k2];
      dataTable($('#i1Tbl', root), [
        { k: 'zip', h: 'ZIP', l: 1, f: (v, r) => `<b>${esc(v)}</b>` }, { k: 'city', h: 'City', l: 1 }, { k: 'idx', h: 'Index', f: v => D(v, 0) },
        { k: k2, h: st.layer === 'idx' ? '15+ yrs' : 'Value', f: v => L2.f(v) }, { k: 'occ', h: 'Households', f: v => N(v) }
      ], rows, { sortKey: 'idx', id: r => r.zip, onClick: z => select(z), rowClass: r => r.zip === st.sel ? 'sel' : '' });
    }
    function zbar(lab, zv, txt) { const w = Math.min(47, Math.abs(zv) * 17), lft = zv >= 0 ? '50%' : (50 - w) + '%'; return `<div class="zbar"><div class="zl">${lab}</div><div class="zt"><div class="zm"></div><div class="zf" style="left:${lft};width:${w}%;background:${zv >= 0 ? cssv('--heat') : cssv('--cool')}"></div></div><div class="zv">${txt}</div></div>`; }
    function drawDetail() {
      const z = st.sel ? ZI[st.sel] : null;
      if (!z || z.occ < 200) {
        $('#i1Name', root).textContent = st.county ? CNAME(st.county) + ' County' : 'All 263 residential ZIPs'; $('#i1Sub', root).textContent = 'Metro position · click any ZIP'; $('#i1Pill', root).textContent = 'Metro';
        const rows = ZR.filter(r => !st.county || r.fips === st.county); const sys = sum(rows.map(r => r.sys));
        $('#i1Detail', root).innerHTML = `<div class="rowl"><span>Central systems (est.)</span><b>${N(sys)}</b></div><div class="rowl"><span>Systems 15 years or older</span><b>${P(sum(rows.map(r => r.ge15)) / sys * 100)}</b></div><div class="rowl"><span>Original builder systems</span><b>${P(sum(rows.map(r => r.orig)) / sys * 100)}</b></div><div class="rowl"><span>R22 era systems still running</span><b>${P(sum(rows.map(r => r.r22)) / sys * 100)}</b></div><div class="rowl"><span>Expected replacements, 2026</span><b>${N(sum(rows.map(r => r.rep)))}</b></div><div class="rowl"><span>Gas furnaces 20 years or older</span><b>${N(sum(rows.map(r => r.furn20)))}</b></div><div class="rowl"><span>Median of ZIP median year built</span><b>${D(median(rows.map(r => r.medyr)), 0)}</b></div>
        <p class="mini" style="margin-top:12px">Two checks that the model is internally sound: the metro replacement rate of ${P(META.rep / META.sys * 100, 1)} a year sits just under the fitted steady state of 1 / ${D(META.weib.AC_TX.mean, 1)} years = ${P(100 / META.weib.AC_TX.mean, 1)}, as it must with a growing stock; and the modeled installed base implies ${N(META.sys)} systems against ${N(META.occ)} occupied homes, consistent with RECS 2020 Texas (${D(DATA.recs_tx.acequip[1], 1)}% of households that cool use central air) plus two-system homes.</p>`;
        return;
      }
      const rank = ZR.slice().sort((a, b) => b.idx - a.idx).findIndex(r => r.zip === z.zip) + 1;
      $('#i1Name', root).textContent = `${z.zip} · ${z.city}`; $('#i1Sub', root).textContent = `${z.cty} County · ${N(z.occ)} households · median year built ${D(z.medyr, 0)}`;
      const qn = ['Anchor', 'Whitespace', 'Niche', 'Avoid'][z.quad]; $('#i1Pill', root).textContent = 'Paid: ' + (qn || '—');
      const yb = z.yb || []; const ybl = ['2020+', '2010s', '2000s', '1990s', '1980s', '1970s', '1960s', '1950s', '1940s', 'pre 1940']; const ybt = sum(yb) || 1;
      const bands = z.bands || [], bt = sum(bands) || 1;
      const notes = [];
      if (z.r22_sh >= 17) notes.push(callout('judg tight', 'R22 heavy', `${P(z.r22_sh, 0)} of systems here were installed before the 2010 R22 equipment ban. Any refrigerant leak on one of them is a replacement quote, and the pitch is a matched A2L system, not a recharge.`));
      if (z.origwin_sh >= 18) notes.push(callout('judg tight', 'Builder wave in its first failure window', `${P(z.origwin_sh, 0)} of systems are still the builder's original in homes aged 10 to 25. The first replacement is the one no contractor owns yet; the homeowner has never bought HVAC.`));
      if (z.furn20_sh >= 14.5) notes.push(callout('judg tight', 'Old furnaces', `${P(z.furn20_sh, 0)} of gas furnaces are 20 years or older. Heating season marketing here is safety inspections and heat exchanger checks, not tune-up coupons.`));
      if (z.hail_recent >= 8) notes.push(callout('tight', 'Recent large hail', `${N(z.hail_recent)} reports of 1.75 inch or larger hail within 8 km since 2023. Condenser coil damage claims follow roof claims by weeks to months.`));
      if (isN(z.perm_cap) && z.perm_share >= .5) notes.push(callout('note tight', 'Observed permits', `${esc(z.perm_city)} issues about ${N(z.perm_obs)} HVAC mechanical permits a year in this ZIP against ${N(z.perm_model)} modeled replacements in its city portion: a capture ratio of ${P(z.perm_cap * 100, 0)} (metro files average about 21%).`));
      $('#i1Detail', root).innerHTML = `<div class="big">${D(z.idx, 0)}<span style="font-size:13px;font-weight:500;color:var(--ink-3)">th percentile</span></div><div class="mini" style="margin-bottom:10px">Thermal Debt Index · rank ${rank} of ${ZR.length} (1 = most debt)</div>
        ${zbar('Systems 15+ yrs ' + P(z.ge15_sh, 0), z.z_aged, S(z.z_aged, 1) + 'σ')}${zbar('Replacement rate ' + D(z.rep_per1k, 0) + '/1k', z.z_rate, S(z.z_rate, 1) + 'σ')}${zbar('Builder wave ' + P(z.origwin_sh, 0), z.z_wave, S(z.z_wave, 1) + 'σ')}${zbar('Furnaces 20+ ' + P(z.furn20_sh, 0), z.z_furn, S(z.z_furn, 1) + 'σ')}${zbar('Hail reports ' + D(z.hail1_8km, 0), z.z_hail, S(z.z_hail, 1) + 'σ')}${zbar('Built 1980 to 99 ' + P(z.yb_duct, 0), z.z_duct, S(z.z_duct, 1) + 'σ')}${zbar('Systems per contractor', z.z_supply, S(z.z_supply, 1) + 'σ')}
        <p class="mini" style="margin:6px 0 10px">Bars are standard deviations from the 263-ZIP mean; right and orange means more debt than average on that component.</p>
        <div class="dsec">Installed base (model)</div>
        <div class="rowl"><span>Central systems · owner single-family</span><b>${N(z.sys)} · ${N(z.sys_ownsf)}</b></div>
        <div class="rowl"><span>Replacements due 2026 · per 1,000 households</span><b>${N(z.rep)} · ${D(z.rep_per1k, 1)}</b></div>
        <div class="rowl"><span>Systems 15+ · 20+ years</span><b>${P(z.ge15_sh, 1)} · ${P(z.ge20_sh, 1)}</b></div>
        <div class="rowl"><span>Original systems · in first failure window</span><b>${P(z.orig_sh, 1)} · ${P(z.origwin_sh, 1)}</b></div>
        <div class="rowl"><span>R22 era systems still running</span><b>${P(z.r22_sh, 1)} (${N(z.r22)})</b></div>
        <div class="rowl"><span>Gas furnaces · 20+ years</span><b>${N(z.furn)} · ${P(z.furn20_sh, 1)}</b></div>
        <div class="rowl"><span>Heat pump share (model)</span><b>${P(z.hp_sh, 0)}</b></div>
        <div style="margin-top:8px"><div class="mini">System age today (model)</div><div style="display:flex;height:12px;border-radius:3px;overflow:hidden;margin-top:4px">${bands.map((b, i) => `<i title="${['0 to 4', '5 to 9', '10 to 14', '15 to 19', '20+'][i]} years: ${P(b / bt * 100, 0)}" style="display:block;flex:${b};background:${ramp('ember')[1 + i * 1.5 | 0]}"></i>`).join('')}</div><div class="rlabs"><span>new</span><span>20+ years</span></div></div>
        <div class="dsec">Housing stock (ACS 2020 to 2024)</div>
        <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:3px;align-items:end;height:60px;margin:6px 0 2px">${yb.map((v, i) => `<div title="${ybl[i]}: ${N(v)} units" style="background:${i < 2 ? cssv('--s1') : cssv('--heat')};height:${Math.max(2, 58 * v / Math.max(...yb, 1))}px;border-radius:2px 2px 0 0"></div>`).join('')}</div><div style="display:grid;grid-template-columns:repeat(10,1fr);gap:3px;font-size:9px;color:var(--ink-3);text-align:center">${ybl.map(l => `<span>${l}</span>`).join('')}</div>
        <div class="rowl" style="margin-top:6px"><span>Median year built · owners · renters</span><b>${D(z.medyr, 0)} · ${D(z.medyr_own, 0)} · ${D(z.medyr_rent, 0)}</b></div>
        <div class="rowl"><span>Owner single-family · rented single-family</span><b>${P(z.own_sf_sh, 0)} · ${P(z.rent_sf_sh, 0)} of SF</b></div>
        <div class="rowl"><span>Heat: gas · electric</span><b>${P(z.gas_sh, 0)} · ${P(z.elec_sh, 0)}</b></div>
        <div class="rowl"><span>Median value · income</span><b>${M$(z.value)} · ${M$(z.inc)}</b></div>
        <div class="rowl"><span>Owners 65+ · moved in since 2020</span><b>${P(z.own65_sh, 0)} · ${P(z.own_recent_sh, 0)}</b></div>
        <div class="rowl"><span>Spanish-speaking households</span><b>${P(z.span_sh, 0)}</b></div>
        ${notes.join('')}`;
    }
    function select(zip) { st.sel = st.sel === zip ? null : zip; render(); }
    // method, coherence, validation, static
    const reachTxt = { aged: 'every system', rate: 'every system', wave: 'homes built 2001 to 2016', furn: 'gas-heated systems', hail: 'every system', duct: 'homes built 1980 to 1999', supply: 'every household' };
    const tierTxt = { aged: 'B', rate: 'B', wave: 'B', furn: 'B', hail: 'C', duct: 'C', supply: 'C' };
    const why = {
      aged: 'Age is the strongest single predictor of failure in the heatmap\'s 57-variable matrix (System age, Strong). Past the fitted median life, every summer is a coin toss.',
      rate: 'Expected renewals per 1,000 households next year: the flow the aged share only implies. Low in new subdivisions, near the 6.4% steady state everywhere older than fifteen years.',
      wave: 'Original builder systems in homes aged 10 to 25: builder-grade equipment, oversized and undercharged more often than not (DOE: more than 65% of residential systems improperly installed), reaching its first failure with no contractor attached.',
      furn: 'The heating side. Furnaces last longer (fitted mean 18.2 years) and fail on the coldest night; age past twenty is the flame safety and heat exchanger conversation.',
      hail: 'Texas has led the nation in major hail events for eleven straight years. Reports within 8 km per decade since 2016; halved because reports follow spotters.',
      duct: 'Flex duct in unconditioned attics degrades on a 20 to 30 year clock. Homes of the 1980s and 1990s are where a like-for-like changeout becomes a reinstall. Halved because duct life is an engineering judgment, not a measurement.',
      supply: 'Systems per HVAC contractor establishment within 8 km. Where supply is thin a contractor can capture demand without prying customers away from a competitor. Halved because NAICS 238220 includes plumbers.'
    };
    $('#i1Method', root).innerHTML = `<p class="body">Each component is standardized across the 263 residential ZIPs (a z-score), multiplied by <code>reach × tier</code>, summed, divided by the total weight and turned into a percentile. <b>Reach</b> is the share of the metro's systems the component actually describes; <b>tier</b> is the confidence multiplier: A or B counts 1.0, C counts 0.5. No study gives effect sizes that would let the components be weighted by their causal share of a replacement, so reach stands in for effect size, and that substitution is the largest judgment call in the build.</p>
      <div class="xscroll"><table style="margin-top:10px"><thead><tr><th class="l">Component</th><th>Reach</th><th>Tier</th><th>Weight</th></tr></thead><tbody>${COMP_KEYS.map(([k, lab]) => `<tr><td class="l wrap" style="min-width:220px"><b>${lab}</b><div class="mini" style="margin-top:2px">${why[k]}</div></td><td>${D(R[k], 3)}<div class="mini">${reachTxt[k]}</div></td><td>${tierTxt[k] === 'C' ? '0.5' : '1.0'} ${G(tierTxt[k])}</td><td><b>${D(W[k], 4)}</b></td></tr>`).join('')}<tr><td class="l" colspan="3" style="text-align:right">Total weight</td><td><b>${D(Wsum, 4)}</b></td></tr></tbody></table></div>
      ${callout('judg tight', 'Judgment call: old fleets and builder waves are both debt', `The aged share and the builder wave pull in opposite directions (r = ${D(DATA.index.corr.aged.wave, 2)}): the oldest ZIPs have already replaced their original systems once or twice, while the 2000s and 2010s suburbs are still on the builder's equipment. Both are debt coming due, of different kinds. The index keeps both at their reach-weighted strength instead of choosing one; the Replacement Wave tab separates them.`)}
      ${callout('judg tight', 'Judgment call: ability to pay is left out on purpose', 'Income and home value are not in the index. Debt is a property of the equipment; whether a household can pay to retire it belongs to the paid acquisition model (module 05), which multiplies this map by case value and divides it by competition. Keeping them apart is what lets the two maps disagree usefully.')}`;
    const lab = { aged: 'Aged', rate: 'Rate', wave: 'Wave', furn: 'Furnace', hail: 'Hail', duct: 'Duct', supply: 'Supply' };
    $('#i1Cohere', root).innerHTML = corrMatrix(COMP_KEYS.map(k => k[0]), lab, DATA.index.corr) + `<p class="body" style="margin-top:12px"><b>They are not one variable.</b> The aged share and the old-furnace share travel together almost perfectly (r = ${D(DATA.index.corr.aged.furn, 2)}): the same old neighborhoods carry both, which is why the furnace component is weighted by gas reach only. The builder wave runs against age (r = ${D(DATA.index.corr.aged.wave, 2)}), hail is close to orthogonal to everything (it is weather, not housing), and contractor supply is thinnest where the stock is newest (r = ${D(DATA.index.corr.supply.wave, 2)} with the wave).</p>
      <p class="body"><b>Sensitivity.</b> An equal-weight index correlates r = ${D(DATA.index.sens[0], 3)} with the weighted one, Spearman ρ = ${D(DATA.index.sens[1], 3)}. The ranking barely depends on the weights; ZIPs that move most are the ones where hail or supply alone is extreme, because equal weighting lifts the two C-grade components to full strength.</p>`;
    // validation scatters
    const vp = DATA.index.valpts;
    const mk = (city, host, note) => { const pts = vp.filter(p => p.city === city).map(p => ({ x: p.idx, y: p.obs, lab: p.zip, tip: `<div class="tt">${p.zip}</div>${tipRow('Index', D(p.idx, 0))}${tipRow('Permits per 1,000 systems', D(p.obs, 1))}${tipRow('Median income', M$(p.inc))}` })); const r = scatter($(host, root), { pts, x: { label: 'Thermal Debt Index (percentile)', fmt: v => D(v, 0), min: 0, max: 100 }, y: { label: city + ': permits per 1,000 systems a year', fmt: v => D(v, 0) }, labels: 0, H: 320 }); $(note, root).innerHTML = `<b>${city}</b>: Pearson r = ${D(r.r, 2)} across ${r.n} ZIPs (Spearman ${D((DATA.index.val[city] || {}).rs, 2)}).`; return r; };
    mk('Dallas', '#i1Sc1', '#i1Sc1n'); mk('Fort Worth', '#i1Sc2', '#i1Sc2n');
    $('#i1Val', root).innerHTML = callout('judg', 'Judgment call: these are checks, not proofs, and one of them fails', `Dallas agrees with the index (r = ${D(DATA.index.val.Dallas.r, 2)}, 44 ZIPs). Fort Worth does not (r = ${D(DATA.index.val['Fort Worth'].r, 2)}, 22 ZIPs). The reason is in module 04: permit capture is an income gradient. A ZIP where median income is 10% higher pulls about ${D(META.cap_elast.b * 10, 0)}% more permits for the same modeled replacements (elasticity ${D(META.cap_elast.b, 2)}, standard error ${D(META.cap_elast.se, 2)}), and Fort Worth's oldest ZIPs are its lowest income ones, so their change-outs go unpermitted and their observed rate falls exactly where the index rises. Permits are the only independent outcome measured by ZIP, they point the right way where income does not confound them, and where it does the confounding is itself a finding: <b>the permit file is an income map as much as an HVAC map.</b>`);
    $('#i1Cav', root).innerHTML = proseTable([
      ['Equipment, not events', 'Every layer describes the installed base and the conditions around it, not a count of service calls or sales. No agency counts HVAC replacements.'],
      ['Ecological reading only', 'A ZIP with an old fleet contains new systems, and a new subdivision contains a lemon. Nothing here describes a household.'],
      ['The age model is fitted, not observed', `Ages come from a renewal process with Weibull lifetimes fitted to ${N(META.weib.AC_TX.n)} Texas RECS households (mean ${D(META.weib.AC_TX.mean, 1)} years, sampling error ±${D(META.weib.AC_TX.se_mean, 1)}). Respondents estimate their equipment age, which flattens the fitted hazard; the steeper engineering scenarios are one click away in module 04.`],
      ['ACS is a survey', 'ZIP estimates carry margins of error; the detail panel shows them for median year built, value and income. Units built 2020 or later are counted only through the 2024 survey year.'],
      ['Within-decade timing is allocated', 'ACS reports decades. Single years inside 1990 to 2024 are allocated by each county\'s Census building permits (one-year lag to completion); earlier decades are spread evenly.'],
      ['Hail reports are not hail', 'NOAA Storm Events records reports, which cluster where people are. The layer is graded C and halved in the index.'],
      ['Contractor counts mix trades', 'NAICS 238220 is plumbing, heating and air conditioning together. TDLR license counts (module 07) are pure HVAC but only by county.'],
      ['Research material', 'Not engineering, legal or financial advice. Verify against the primary source before siting a location or signing a lease.'],
    ]);
    $('#i1Gap', root).innerHTML = proseTable([
      ['Actual equipment ages by address', 'Appraisal districts record year built, not HVAC install dates. Permit files hold install dates only for permitted jobs (about one in five), and only in cities that publish them.', 'X'],
      ['Replacements that were never permitted', 'By construction invisible. The permit capture ratio (about 21% in Dallas, Fort Worth and Irving) is the only handle.', 'X'],
      ['Equipment brand and efficiency tier', 'AHRI certifies equipment, not installations. No public file says which brand sits behind which house.', 'X'],
      ['Home warranty and service plan coverage', 'Home warranty companies and membership plans are private books.', 'X'],
      ['Commercial rooftop units', 'The model is residential. CBECS has no DFW sample; commercial permits are mixed into the Fort Worth file and cannot be separated after 2014.', 'C'],
      ['Urban heat island by ZIP', 'The heatmap carried a modeled city score (grade D). Satellite land surface temperature by ZIP was not built for this edition.', 'D'],
    ].map(r => [r[0], r[1], G(r[2])]));
    $('#i1Src', root).innerHTML = srcRows([
      ['Housing age, tenure, structure, heating fuel, value, income', 'U.S. Census Bureau, ACS 2020 to 2024 five-year, table-based summary file (B25034, B25035, B25036, B25127, B25040, B25117, B25003, B25024, B25032, B25077, B19013, B25018, B25041, B25038, B25007, C16002)', 'A', 'Dec 2025 release', 'https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/'],
      ['Equipment lifetimes', 'EIA Residential Energy Consumption Survey 2020 public microdata v7, Texas households; renewal-process Weibull fits by this build', 'B', '2020 (fielded 2020 to 2021)', 'https://www.eia.gov/consumption/residential/data/2020/'],
      ['Within-decade build timing', 'U.S. Census Bureau Building Permits Survey, county annual files 1990 to 2025', 'A', '2025', 'https://www2.census.gov/econ/bps/County/'],
      ['ZIP geography and apportioning', 'Census 2020 ZCTA cartographic boundaries; 2020 block to ZCTA relationship file; P.L. 94-171 block housing counts', 'A', '2020', 'https://www2.census.gov/geo/'],
      ['Hail', 'NOAA NCEI Storm Events Database, Texas detail files 1996 to 2026', 'C', 'through Aug 2026', 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/'],
      ['Contractor establishments', 'County Business Patterns, ZIP Code Business Patterns 2016 and 2023, NAICS 238220', 'B', '2023', 'https://www2.census.gov/programs-surveys/cbp/datasets/'],
      ['Competitors', 'DFW HVAC Competitive Heatmap roster (242 locations; Google Business Profile data and Ahrefs, August 18, 2026)', 'C', 'Aug 2026', ''],
      ['Validation permits', 'City of Dallas building permits (2018 to Aug 2020); City of Fort Worth development permits (2012 to Sep 2026); City of Irving residential permits (Feb 2022 to Feb 2025)', 'B', '2026', 'https://www.dallasopendata.com/'],
    ]);
    $('#i1Foot', root).innerHTML = `<b style="color:var(--ink)">DFW Thermal Debt Atlas</b>, module 01. Compiled September 25, 2026 for 277 ZIP codes in Collin, Dallas, Denton, Ellis, Hood, Hunt, Johnson, Kaufman, Parker, Rockwall, Tarrant and Wise counties. The index is a percentile of equipment condition, not a rate of anything. Grades: A primary and direct; B primary with a caveat or a model on primary data; C secondary, volatile or proxy; D assumption or over ten years old. Built from public data only; no Ahrefs pull was made for this build.`;
    // wiring
    $('#i1Layer', root).onchange = e => { st.layer = e.target.value; render(); };
    $('#i1Cty', root).onchange = e => { st.county = e.target.value; if (st.county) map.fitTo(Z.filter(z => z.fips === st.county).map(z => z.zip)); else map.reset(); render(); };
    $('#i1Comp', root).onchange = e => { st.comp = e.target.checked; render(); };
    $('#i1Find', root).addEventListener('change', e => { const q = e.target.value.trim().toLowerCase(); if (!q) return; const hit = ZI[q] || ZR.filter(z => (z.city || '').toLowerCase().startsWith(q)).sort((a, b) => b.occ - a.occ)[0]; if (hit) { st.sel = hit.zip; map.fitTo([hit.zip]); render(); } else toast('No ZIP or city matches'); });
    $('#i1Csv', root).onclick = () => { const keys = ['zip', 'city', 'cty', 'occ', 'idx', 'idx_eq', 'ge15_sh', 'ge20_sh', 'rep', 'rep_per1k', 'orig_sh', 'origwin_sh', 'first5', 'r22_sh', 'furn', 'furn20_sh', 'hp_sh', 'medyr', 'yb_pre1980', 'yb_duct', 'yb_2000_09', 'yb_2010_19', 'yb_2020p', 'own_sf_sh', 'rent_sf_sh', 'gas_sh', 'elec_sh', 'hail1_8km', 'hail175_8km', 'sys_per_est8', 'value', 'inc', 'span_sh'];
      saveFile('dfw-thermal-debt-index-by-zip.csv', toCSV(keys, ZR.map(z => keys.map(k => z[k])), 'DFW Thermal Debt Atlas, module 01, compiled 2026-09-25.\nModeled installed base: renewal process on ACS 2020-2024 year built, Weibull lifetimes fitted to RECS 2020 Texas. Percent values are percentages.\nidx = percentile of reach x tier weighted z-scores; higher = more thermal debt.')); };
    $('#i1Rep', root).onclick = () => goModule('replace', { zip: st.sel });
    const topZ = () => ZR.filter(z => !st.county || z.fips === st.county).sort((a, b) => b.idx - a.idx).slice(0, 25).map(z => z.zip);
    $('#i1Desk', root).onclick = () => goModule('desk', { zips: st.sel ? [st.sel] : topZ() });
    $('#i1Forge', root).onclick = () => goModule('forge', { zips: st.sel ? [st.sel] : topZ() });
    $('#i1Lines', root).onclick = () => goModule('lines', st.sel ? { zip: st.sel } : {});
    BUS.on('theme', () => render());
    this.receive = p => { if (p && p.zip && ZI[p.zip]) { st.sel = p.zip; map.fitTo([p.zip]); render(); } };
    render();
  }
});
