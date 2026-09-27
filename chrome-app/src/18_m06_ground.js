/* ==== m06_ground ==== */
"use strict";
/* ============================ Module 6: Ground Truth ============================ */
registerModule({
  key: 'ground', num: '06', title: 'Ground Truth', desc: 'Counties and cities as observed: permits, hail, licenses, contractors, housing',
  mount(root) {
    const st = { layer: 'perm_rate', sel: null, byCounty: false, cities: false };
    const zp = z => (isN(z.perm_obs) && z.perm_share >= 0.5) ? z.perm_obs / Math.max(1, z.sys * z.perm_share) * 1000 : null;
    const GL = {
      perm_rate: { l: 'Observed HVAC permits per 1,000 systems a year (city portion)', ramp: 'ember', f: v => D(v, 1), v: zp, g: 'B', obs: 1, note: 'Fort Worth 2016 to 2025, Dallas 2018 to 2020, Irving 2022 to 2025. Only ZIPs at least half inside one of the three cities.' },
      perm_cap: { l: 'Permit capture: observed over modeled (%)', ramp: 'blue', f: v => P(v, 0), v: z => isN(z.perm_cap) && z.perm_share >= .5 ? z.perm_cap * 100 : null, g: 'B', obs: 1, note: 'Share of modeled replacements that appear as a city permit.' },
      hail1_in: { l: 'Hail reports of 1 inch or larger inside the ZIP, 2016 to 2026', ramp: 'ember', f: v => N(v), v: z => z.hail1_in, g: 'C', obs: 1, note: 'NOAA Storm Events point reports inside the ZIP polygon.' },
      est23: { l: 'HVAC and plumbing establishments, 2023', ramp: 'blue', f: v => N(v), v: z => z.est23, g: 'B', obs: 1, note: 'ZIP Code Business Patterns, NAICS 238220.' },
      est_chg: { l: 'Change in establishments, 2016 to 2023', ramp: 'blue', f: v => S(v, 0), v: z => z.est23 - z.est16, g: 'B', obs: 1, note: 'ZBP 2023 minus ZBP 2016.' },
      comp_n8: { l: 'Mapped competitor locations within 8 km', ramp: 'blue', f: v => N(v), v: z => z.comp_n8, g: 'C', obs: 1, note: 'Heatmap roster, August 2026.' },
      medyr: { l: 'Median year built', ramp: 'ember', f: v => D(v, 0), v: z => z.medyr, g: 'A', obs: 1, dir: -1, note: 'ACS B25035.' },
      gas_sh: { l: 'Gas-heated homes (%)', ramp: 'ember', f: v => P(v, 0), v: z => z.gas_sh, g: 'A', obs: 1, note: 'ACS B25040.' },
      own_sf_sh: { l: 'Owner single-family households (%)', ramp: 'teal', f: v => P(v, 0), v: z => z.own_sf_sh, g: 'A', obs: 1, note: 'ACS B25032.' },
      span_sh: { l: 'Spanish-speaking households (%)', ramp: 'teal', f: v => P(v, 0), v: z => z.span_sh, g: 'A', obs: 1, note: 'ACS C16002.' },
      occ: { l: 'Households', ramp: 'teal', f: v => N(v), v: z => z.occ, g: 'A', obs: 1, note: 'ACS B25002.' },
      rep: { l: 'Modeled replacements, 2026', ramp: 'ember', f: v => N(v), v: z => z.rep, g: 'B', obs: 0, note: 'Module 02.' },
      first5: { l: 'Modeled first replacements, 2026 to 2030', ramp: 'ember', f: v => N(v), v: z => z.first5, g: 'B', obs: 0, note: 'Module 02.' },
      opp_usd: { l: 'Modeled job value pool ($)', ramp: 'ember', f: v => MM(v), v: z => z.opp_usd, g: 'C', obs: 0, note: 'Module 05.' },
      idx: { l: 'Thermal Debt Index', ramp: 'ember', f: v => D(v, 0), v: z => z.idx, g: 'B', obs: 0, note: 'Module 01.' },
    };
    const CL = { con10k: ['Active ACR contractor licenses per 10,000 households', c => c.lic_con / c.occ * 1e4, v => D(v, 1)], tech10k: ['Active technician licenses per 10,000 households', c => c.lic_tech / c.occ * 1e4, v => D(v, 1)], sysTech: ['Systems per licensed technician', c => c.sys / c.lic_tech, v => N(v)], hail: ['Hail reports 1 inch or larger since 2016', c => c.hail1_2016, v => N(v)], bps: ['Single-family permits 2015 to 2025', c => c.bps_u1_2015_25, v => N(v)], rep1k: ['Modeled replacements per 1,000 households', c => c.rep / c.occ * 1000, v => D(v, 1)] };
    root.innerHTML = mastHTML({ eyebrow: 'Module 06 · Ground Truth · counties and cities', title: 'Ground Truth', dek: 'The ledger as observed before any model touches it: the permits three cities actually issued, the hail NOAA actually recorded, the licenses TDLR actually holds, the contractor establishments the Census actually counted, and the housing the ACS actually surveyed. Then the atlas\'s own modeled layers on top, labeled as such, for every county and every city of 5,000 or more.',
      meta: [`<b>12</b> counties · <b>${N(CITIES.length)}</b> cities`, `<b>${N(Z.filter(z => zp(z) != null).length)}</b> ZIPs with an observed permit rate`, `<b>${N(DATA.hail.rows.filter(r => r[0] >= 2016).reduce((s, r) => s + r[2], 0))}</b> hail reports 1 inch or larger since 2016`, `<b>${N(META.lic_con_dfw)}</b> active contractor licenses`],
      bar: 'Ground Truth', barsub: 'Observed layers first, modeled second', actions: [{ id: 'g6Co', label: '↓ Counties CSV' }, { id: 'g6Ci', label: '↓ Cities CSV' }, { id: 'g6Paid', label: 'Paid ↗' }, { id: 'g6Desk', label: 'Campaign Desk ↗' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: observed layers first, modeled layers second', `The first group of layers is what someone else measured: city permit clerks, NOAA storm spotters, TDLR licensing, the Census Bureau's business register and its housing survey. The second group is this atlas's arithmetic (replacements, first replacements, job value, the index), carried down from modules 01, 02 and 05 and labeled as modeled. The two disagree in one systematic place: permits. Three city files record ${P(META.cal.Dallas.cap * 100, 0)} to ${P(META.cal['Fort Worth'].cap * 100, 0)} of the replacements the installed base implies, and the gap is widest in lower-income ZIPs. Every other gap on this page is a genuine absence of data.`)}
      <div class="kpis" id="g6Kpis"></div>
      <div class="controls">
        <div class="ctl" style="flex:1 1 320px"><label class="fl" for="g6Layer">Layer</label><select id="g6Layer"><optgroup label="Observed">${Object.entries(GL).filter(([k, o]) => o.obs).map(([k, o]) => `<option value="${k}">${esc(o.l)}</option>`).join('')}</optgroup><optgroup label="Modeled">${Object.entries(GL).filter(([k, o]) => !o.obs).map(([k, o]) => `<option value="${k}">${esc(o.l)}</option>`).join('')}</optgroup><optgroup label="County level (observed)">${Object.entries(CL).map(([k, o]) => `<option value="c:${k}">${esc(o[0])}</option>`).join('')}</optgroup></select></div>
        <label class="chk"><input type="checkbox" id="g6Cities"> show city points</label>
      </div>
      <div class="grid2">
        <div class="card mapcard"><div id="g6Map"></div><div class="legend" id="g6Leg"></div></div>
        <div class="card"><div class="card-h"><h3 id="g6Name">No county selected</h3><p id="g6Sub">Click a ZIP to open its county, or a row below</p></div><div class="card-b" id="g6Det"><p class="mini">Every county carries its observed housing, licensing, permit, hail and contractor facts, its modeled replacement and value figures, and its city roster.</p></div></div>
      </div>
      ${card('Counties', 'Twelve counties. Observed columns first, then modeled. Click a row to open it.', '<div class="tscroll" id="g6CoT"></div>', 'mt')}
      <div class="card mt"><div class="card-h" style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap"><h3 style="flex:1;min-width:160px">Cities: <span id="g6CiN"></span></h3><label class="fl" for="g6CiCty">County</label><select id="g6CiCty"><option value="">All</option>${CO.map(c => `<option value="${c.fips}">${c.name}</option>`).join('')}</select></div><div class="tscroll" id="g6CiT"></div></div>
      <div class="split">
        ${card('The urban to exurban gradient', 'Household-weighted means by housing density class across the 263 residential ZIPs.', '<div class="xscroll" id="g6Grad"></div>')}
        ${card('Clusters and contractor deserts', 'Hot spots of the Thermal Debt Index (local Moran, p below 0.05) and ZIPs with at least 1,500 systems and no mapped competitor within 8 km.', '<div id="g6Clu"></div>')}
      </div>
      ${card('How to read this module', '', '<ol class="meth" id="g6How"></ol>', 'mt')}
      <div class="split">${card('Caveats', '', '<div id="g6Cav"></div>')}${card('Source register', '', '<div id="g6Src"></div>')}</div>
      <div class="foot">DFW Thermal Debt Atlas, module 06. County figures from ZIP outputs are apportioned with 2020 block housing counts; ACS county facts are read directly from county summary levels.</div></div>`;
    $('#g6Kpis', root).innerHTML = kpiHTML([
      { l: 'Permits observed', g: 'B', v: N(META.cal['Fort Worth'].obs + META.cal.Dallas.obs + META.cal.Irving.obs), d: 'a year across Fort Worth, Dallas and Irving files' },
      { l: 'Modeled in those cities', g: 'B', v: N(META.cal['Fort Worth'].model + META.cal.Dallas.model + META.cal.Irving.model), d: 'replacements a year in the same city portions' },
      { l: 'Hail reports since 2023', g: 'C', v: N(DATA.hail.rows.filter(r => r[0] >= 2023).reduce((s, r) => s + r[1], 0)), d: `${N(DATA.hail.rows.filter(r => r[0] >= 2023).reduce((s, r) => s + r[3], 0))} at 1.75 inch or larger` },
      { l: 'Contractor licenses', g: 'A', v: N(META.lic_con_dfw), d: `${N(META.lic_tech_dfw)} technicians, ${N(META.lic_cert_dfw)} certified` },
      { l: 'HVAC establishments', g: 'B', v: N(META.cbp.e23), d: `${S((META.cbp.e23 / META.cbp.e16 - 1) * 100, 0)}% since 2016 (CBP, NAICS 238220)` },
      { l: 'Median year built', g: 'A', v: D(META.medyr_msa, 0), d: `DFW metro; Texas ${D(META.medyr_tx, 0)}, United States ${D(META.medyr_us, 0)}` },
    ]);
    const map = new ZipMap($('#g6Map', root), { onSelect: zip => { const z = ZI[zip]; if (z && z.fips) { st.sel = z.fips; render(); } }, onHover: (zip, e) => { const z = ZI[zip]; if (!z) return; const lk = $('#g6Layer', root).value; let row = ''; if (lk.startsWith('c:')) { const c = COI[z.fips]; const o = CL[lk.slice(2)]; row = c ? tipRow(o[0], o[2](o[1](c))) : ''; } else { const o = GL[lk]; row = tipRow(o.l, o.f(o.v(z))); } showTip(`<div class="tt">${z.zip} · ${esc(z.city)}</div><div class="ts">${esc(z.cty)} County</div>${row}`, e); } });
    function render() {
      const lk = $('#g6Layer', root).value; let f, lo, hi, R, title, note, g;
      if (lk.startsWith('c:')) { const o = CL[lk.slice(2)]; const vals = CO.map(o[1]); const sc = qScale(vals, 'teal', 1); f = z => { const c = COI[z.fips]; return c ? sc.f(o[1](c)) : null; }; lo = o[2](Math.min(...vals)); hi = o[2](Math.max(...vals)); R = sc.R; title = o[0]; note = 'County-level value painted on every ZIP in the county.'; g = 'A'; }
      else { const o = GL[lk]; const vals = Z.map(o.v); const sc = qScale(vals, o.ramp, o.dir || 1); f = z => (z.occ >= 200 || o.obs) ? sc.f(o.v(z)) : null; const v = vals.filter(isN); lo = o.f(Math.min(...v)); hi = o.f(Math.max(...v)); R = sc.R; title = o.l; note = o.note + (o.obs ? ' <b>Observed.</b>' : ' <b>Modeled.</b>'); g = o.g; }
      map.fill(zip => { const z = ZI[zip]; return z ? f(z) : null; });
      map.dim(st.sel ? new Set(Z.filter(z => z.fips === st.sel).map(z => z.zip)) : null);
      map.pins($('#g6Cities', root).checked ? CITIES.filter(c => c.pop >= 10000 && isN(c.lat)).map((c, i) => ({ id: 'c' + i, lat: c.lat, lon: c.lon, r: 2 + Math.sqrt(c.pop / 20000), fill: cssv('--ink-2'), op: .7 })) : []);
      $('#g6Leg', root).innerHTML = legendHTML({ title, R, lo, hi, note: note + ' ' + G(g) + ' Gray: no observation (for permit layers, outside the three permit cities).' });
      detail();
    }
    function detail() {
      const c = st.sel ? COI[st.sel] : null; if (!c) return;
      const cities = CITIES.filter(x => x.fips === c.fips).sort((a, b) => b.pop - a.pop);
      $('#g6Name', root).textContent = c.name + ' County'; $('#g6Sub', root).textContent = `${N(c.pop)} people · ${N(c.nzip)} residential ZIPs · median year built ${D(c.medyr, 0)}`;
      $('#g6Det', root).innerHTML = `<div class="dsec">Observed</div>
        <div class="rowl"><span>Households · owner share</span><b>${N(c.occ_acs)} · ${P(c.own_sh, 0)}</b></div>
        <div class="rowl"><span>Median year built ±MOE</span><b>${D(c.medyr, 0)} ±${D(c.moe_medyr, 0)}</b></div>
        <div class="rowl"><span>Gas · electric heat</span><b>${P(c.gas_sh, 0)} · ${P(c.elec_sh, 0)}</b></div>
        <div class="rowl"><span>Median value · income</span><b>${M$(c.value)} · ${M$(c.inc)}</b></div>
        <div class="rowl"><span>Built before 1980 · 2000s · 2010 and later</span><b>${P(c.yb_pre1980, 0)} · ${P(c.yb_2000_09, 0)} · ${P(c.yb_2010p, 0)}</b></div>
        <div class="rowl"><span>ACR contractor licenses (Class A)</span><b>${N(c.lic_con)} (${N(c.lic_conA)})</b></div>
        <div class="rowl"><span>Technician licenses (certified)</span><b>${N(c.lic_tech)} (${N(c.lic_cert)})</b></div>
        <div class="rowl"><span>HVAC establishments 2016 → 2023</span><b>${N(c.est16)} → ${N(c.est23)}</b></div>
        <div class="rowl"><span>Hail 1 inch+ · 1.75 inch+ since 2016</span><b>${N(c.hail1_2016)} · ${N(c.hail175_2016)}</b></div>
        <div class="rowl"><span>Single-family permits 2015 to 2025</span><b>${N(c.bps_u1_2015_25)}</b></div>
        <div class="dsec">Modeled</div>
        <div class="rowl"><span>Central systems · replacements 2026</span><b>${N(c.sys)} · ${N(c.rep)}</b></div>
        <div class="rowl"><span>First replacements 2026 to 2030</span><b>${N(c.first5)}</b></div>
        <div class="rowl"><span>R22 era · furnaces 20+</span><b>${N(c.r22)} · ${N(c.furn20)}</b></div>
        <div class="rowl"><span>Job value pool a year</span><b>${MM(c.opp_usd)}</b></div>
        <div class="rowl"><span>Systems per technician license</span><b>${N(c.sys_per_tech)}</b></div>
        <div class="dsec">Cities</div><div>${cities.slice(0, 18).map(x => `<span class="tag">${esc(x.name)} ${K(x.pop)}</span>`).join('')}</div>`;
    }
    dataTable($('#g6CoT', root), [{ k: 'name', h: 'County', l: 1 }, { k: 'pop', h: 'Population', f: v => N(v) }, { k: 'occ_acs', h: 'Households', f: v => N(v) }, { k: 'medyr', h: 'Med. built', f: v => D(v, 0) }, { k: 'gas_sh', h: 'Gas %', f: v => D(v, 0) }, { k: 'own_sh', h: 'Owner %', f: v => D(v, 0) }, { k: 'lic_con', h: 'Contractors', f: v => N(v) }, { k: 'lic_tech', h: 'Techs', f: v => N(v) }, { k: 'est23', h: 'Estab.', f: v => N(v) }, { k: 'hail1_2016', h: 'Hail 1"+', f: v => N(v) }, { k: 'rep', h: 'Repl. (model)', f: v => N(v) }, { k: 'first5', h: 'First 5 yr (model)', f: v => N(v) }, { k: 'opp_usd', h: 'Value (model)', f: v => MM(v) }], CO, { sortKey: 'pop', id: r => r.fips, onClick: f => { st.sel = f; map.fitTo(Z.filter(z => z.fips === f).map(z => z.zip)); render(); } });
    function cities() { const f = $('#g6CiCty', root).value; const rows = CITIES.filter(c => !f || c.fips === f); $('#g6CiN', root).textContent = `${rows.length} cities of 5,000+`;
      dataTable($('#g6CiT', root), [{ k: 'name', h: 'City', l: 1 }, { k: 'cty', h: 'County', l: 1 }, { k: 'pop', h: 'Population', f: v => N(v) }, { k: 'medyr', h: 'Med. built', f: v => D(v, 0) }, { k: 'gas_sh', h: 'Gas %', f: v => D(v, 0) }, { k: 'own_sh', h: 'Owner %', f: v => D(v, 0) }, { k: 'value', h: 'Value', f: v => M$(v) }, { k: 'inc', h: 'Income', f: v => M$(v) }, { k: 'rep', h: 'Repl. 2026', f: v => N(v) }, { k: 'first5', h: 'First 2026 to 30', f: v => N(v) }, { k: 'r22', h: 'R22 era', f: v => N(v) }, { k: 'opp_usd', h: 'Value pool', f: v => MM(v) }], rows, { sortKey: 'pop', id: r => r.geoid, onClick: g => { const c = CITIES.find(x => x.geoid === g); if (c) { map.fitTo(c.zips); st.sel = c.fips; render(); } } }); }
    $('#g6CiCty', root).onchange = cities; cities();
    // gradient
    const cls = [['Core (3,000+ units per sq mi)', 3000, 1e9], ['Inner suburb (1,500 to 3,000)', 1500, 3000], ['Outer suburb (500 to 1,500)', 500, 1500], ['Exurban (100 to 500)', 100, 500], ['Rural (under 100)', 0, 100]];
    const wm = (rows, k) => { const w = rows.map(r => r.occ); const v = rows.map(r => r[k]); let a = 0, b = 0; v.forEach((x, i) => { if (isN(x)) { a += x * w[i]; b += w[i]; } }); return b ? a / b : null; };
    $('#g6Grad', root).innerHTML = `<table><thead><tr><th class="l">Density class</th><th>ZIPs</th><th>Households</th><th>Med. built</th><th>15+ yrs</th><th>Builder wave</th><th>Gas %</th><th>Owner SF %</th><th>Repl./1k</th><th>Hail/dec</th><th>Mapped comps 8 km</th></tr></thead><tbody>${cls.map(([l, a, b]) => { const r = ZR.filter(z => isN(z.density) && z.density >= a && z.density < b); return `<tr><td class="l">${l}</td><td>${r.length}</td><td>${N(sum(r.map(x => x.occ)))}</td><td>${D(wm(r, 'medyr'), 0)}</td><td>${P(wm(r, 'ge15_sh'), 1)}</td><td>${P(wm(r, 'origwin_sh'), 1)}</td><td>${P(wm(r, 'gas_sh'), 0)}</td><td>${P(wm(r, 'own_sf_sh'), 0)}</td><td>${D(wm(r, 'rep_per1k'), 1)}</td><td>${D(wm(r, 'hail1_8km'), 1)}</td><td>${D(wm(r, 'comp_n8'), 1)}</td></tr>`; }).join('')}</tbody></table><p class="chartnote">The core is old, gas-heated and rented; the outer suburbs carry the builder wave; the exurbs are newest, most electric and least served. Replacement rates barely differ between classes (the steady state again); the kind of job does.</p>`;
    const hot = ZR.filter(z => z.lisa_idx === 'HH').sort((a, b) => b.idx - a.idx); const des = ZR.filter(z => z.comp_n8 === 0 && z.sys >= 1500).sort((a, b) => b.sys - a.sys);
    $('#g6Clu', root).innerHTML = `<div class="dsec">Thermal debt hot spots (${hot.length} ZIPs)</div><div>${hot.slice(0, 30).map(z => `<span class="tag" title="${esc(z.city)}">${z.zip} ${esc(z.city)}</span>`).join('')}</div>
      <div class="dsec">Contractor deserts (${des.length} ZIPs)</div><table><thead><tr><th class="l">ZIP</th><th class="l">City</th><th>Systems</th><th>Replacements</th><th>Nearest mapped</th></tr></thead><tbody>${des.slice(0, 12).map(z => `<tr><td class="l">${z.zip}</td><td class="l">${esc(z.city)}</td><td>${N(z.sys)}</td><td>${N(z.rep)}</td><td>${D(z.comp_near_km, 0)} km</td></tr>`).join('')}</tbody></table><p class="chartnote">A desert is a gap in the mapped roster, not proof no contractor serves the ZIP: the roster is the 242 companies the heatmap researched, and small shops without reviews are invisible to it. Cross-check against the establishment count before siting anything.</p>`;
    $('#g6How', root).innerHTML = [`<b>Observed layers ${G('A')} to ${G('C')}</b>. Housing facts are ACS 2020 to 2024 five-year estimates at ZIP and county level. Permits are counted from each city's own file and divided by modeled systems in the part of the ZIP inside the city (2020 block housing counts). Hail is NOAA Storm Events point reports inside the ZIP polygon. Licenses are TDLR records unexpired on September 25, 2026, by business county. Establishments are County Business Patterns ZIP files for 2016 and 2023.`, `<b>Modeled layers ${G('B')} to ${G('C')}</b>. Replacements, first replacements, R22 and furnace figures are module 02; job value is module 05; the index is module 01. County and city figures are ZIP outputs apportioned by 2020 block housing counts.`, `<b>Cities</b> are Census places of 5,000 or more whose housing lies in the study ZIPs. A city that spans counties is listed in the county holding most of its housing.`].map(x => `<li>${x}</li>`).join('');
    $('#g6Cav', root).innerHTML = proseTable([['Permit layers cover three cities', 'Dallas, Fort Worth and Irving publish permit files with ZIP codes; Plano, Arlington, Frisco and the rest either publish none or publish active permits only.'], ['Permits lag and lead', 'A permit is filed when work is scheduled and finaled when inspected; Fort Worth counts use the file date and exclude void and withdrawn records.'], ['TDLR counts are by business address', 'Technicians register where they or their employer are based, not where they work.'], ['CBP excludes the self-employed', 'Nonemployer HVAC operators, a large share of the trade, are not in County Business Patterns.']]);
    $('#g6Src', root).innerHTML = srcRows([['Permits', 'Cities of Fort Worth, Dallas and Irving open data', 'B', '2012 to 2026', ''], ['Hail', 'NOAA NCEI Storm Events', 'C', '2016 to 2026', 'https://www.ncei.noaa.gov/stormevents/'], ['Licenses', 'TDLR All Licenses via Texas Open Data Portal', 'A', 'Sep 25, 2026', 'https://data.texas.gov/resource/7358-krk7'], ['Establishments', 'Census ZIP Code Business Patterns 2016 and 2023', 'B', '2023', 'https://www2.census.gov/programs-surveys/cbp/datasets/'], ['Housing', 'ACS 2020 to 2024 five-year', 'A', 'Dec 2025', ''], ['Apportioning', '2020 Census P.L. 94-171 block housing units; 2020 block to ZCTA relationship file', 'A', '2020', 'https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/']]);
    $('#g6Layer', root).onchange = render; $('#g6Cities', root).onchange = render;
    $('#g6Co', root).onclick = () => { const k = ['name', 'fips', 'pop', 'occ_acs', 'own_sh', 'medyr', 'moe_medyr', 'gas_sh', 'elec_sh', 'value', 'inc', 'lic_con', 'lic_conA', 'lic_tech', 'lic_cert', 'est16', 'est23', 'hail1_2016', 'hail175_2016', 'bps_u1_2015_25', 'sys', 'rep', 'first5', 'r22', 'furn20', 'opp_usd']; saveFile('dfw-counties-ground-truth.csv', toCSV(k, CO.map(c => k.map(x => c[x])), 'Observed: ACS, TDLR, CBP, NOAA, BPS. Modeled: sys, rep, first5, r22, furn20, opp_usd.')); };
    $('#g6Ci', root).onclick = () => { const k = ['name', 'geoid', 'cty', 'pop', 'medyr', 'gas_sh', 'own_sh', 'value', 'inc', 'sys', 'rep', 'first5', 'r22', 'furn20', 'opp_usd']; saveFile('dfw-cities-ground-truth.csv', toCSV(k, CITIES.map(c => k.map(x => c[x])))); };
    $('#g6Paid', root).onclick = () => goModule('paid', {}); $('#g6Desk', root).onclick = () => goModule('desk', { zips: st.sel ? ZR.filter(z => z.fips === st.sel).sort((a, b) => b.effb - a.effb).slice(0, 30).map(z => z.zip) : null });
    BUS.on('theme', render);
    render();
  }
});
