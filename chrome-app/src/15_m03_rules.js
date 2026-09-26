/* ==== m03_rules ==== */
"use strict";
/* ============================ Module 3: Rules and Refrigerants ============================ */
const RULE_CAL = [
  ['2010-01-01', 'New R22 equipment banned', 'Manufacture of new R22 air conditioners and heat pumps ended; R22 servicing continued on a shrinking supply.', 'EPA Section 605 phaseout', '◐', 'B'],
  ['2020-01-01', 'R22 production ends', 'Only reclaimed or stockpiled R22 remains for service. Every R22 system still running is on borrowed refrigerant.', 'EPA Section 605', '◐', 'B'],
  ['2023-01-01', 'SEER2 floors take effect', 'South region split AC at least 14.3 SEER2 below 45,000 Btu/h (13.8 above); heat pumps 14.3 SEER2 and 7.5 HSPF2 nationwide. Texas is in the South region.', 'DOE 10 CFR 430.32', '◐', 'B'],
  ['2024-01-01', 'HFC allowances cut 40%', 'AIM Act allocation drops to 60% of baseline for 2024 to 2028; R410A prices rise.', 'EPA AIM Act allocation rule', '◐', 'B'],
  ['2025-01-01', 'New R410A split systems end', 'Manufacture and import of new residential and light commercial split systems using refrigerant above 700 GWP prohibited; new equipment ships on A2L refrigerants (R454B, R32).', 'EPA Technology Transitions rule', '◐', 'B'],
  ['2025-07-04', 'One Big Beautiful Bill Act signed', 'Terminates the 25C home improvement credit for property placed in service after December 31, 2025, and 25D for expenditures after that date.', 'Public Law 119-21', '◐', 'B'],
  ['2025-09-01', 'Texas SB 140 in force', 'Text messages count as telephone solicitation under Texas Business and Commerce Code chapter 302; registration and DTPA private right of action apply to marketing texts outside consent-based exemptions.', 'Texas SB 140 (89th Legislature)', '◐', 'B'],
  ['2025-12-31', '25C and 25D expire', 'Heat pump credit of up to $2,000 a year and central AC or furnace credit of up to $600 per item end with property placed in service by this date.', 'IRS, Energy Efficient Home Improvement Credit', '✔', 'A'],
  ['2026-04-01', 'Trane price increase', 'Up to 5% on residential equipment; a second increase of up to 5% followed on July 1. Carrier says it will keep raising prices; tariffs on steel, aluminum and copper are the stated driver.', 'ACHR News, Sep 18, 2026', '✔', 'C'],
  ['2026-04-27', 'Furnace delay petition published', 'DOE publishes the gas industry petition to move the 95% AFUE furnace compliance date from December 18, 2028 to January 1, 2030 at the earliest; comments closed May 27, 2026.', '91 FR (2026-08145)', '✔', 'A'],
  ['2026-05-19', 'Texas home energy rebates still in design', 'SECO: the HOMES and HEAR programs ($690 million) are not available; launch waits on DOE approval, comment period open through the end of August 2026.', 'Texas Comptroller, SECO', '✔', 'A'],
  ['2026-05-26', 'R410A installation deadline removed', 'EPA final rule (effective July 27, 2026) lets R410A split systems manufactured or imported before January 1, 2025 be installed until inventory runs out.', 'NAHB summary of EPA final rule', '✔', 'B'],
  ['2026-06-08', 'Furnace rule remanded', 'The Supreme Court vacates the D.C. Circuit decision upholding the 2023 furnace standard and remands for reconsideration; DOE has proposed delaying the mandate while litigation continues.', 'ACHR News', '✔', 'B'],
  ['2028-12-18', 'Furnace 95% AFUE compliance date', 'Non-weatherized gas furnaces must be condensing, unless delayed. Every 80% furnace sold before then is a noncondensing installation that avoids a new flue and drain.', 'DOE final rule, Dec 18, 2023', '✔', 'A'],
  ['2029-01-01', 'HFC allowances cut 70%', 'Allocation falls to 30% of baseline; R410A service gas tightens again.', 'EPA AIM Act', '◐', 'B'],
  ['2036-01-01', 'HFC phasedown floor', 'Allocation reaches 15% of baseline and stays there.', 'NAHB summary; AIM Act', '✔', 'B'],
];
const INCENTIVES = [
  ['Federal 25C credit', 'Ended', 'Property placed in service after December 31, 2025 does not qualify. Ads, proposals and pages that still say "tax credit" misrepresent a lapsed benefit.', 'IRS', '✔', 'A', 'https://www.irs.gov/credits-deductions/energy-efficient-home-improvement-credit'],
  ['Federal 25D (geothermal)', 'Ended', 'Expenditures after December 31, 2025 excluded.', 'Public Law 119-21', '◐', 'B', ''],
  ['Texas HOMES and HEAR rebates', 'Not launched', '$690 million allocated to SECO; planning and design phase; launch after DOE approval. HEAR is income-qualified up to $14,000 per household; HOMES up to $8,000 by modeled savings.', 'Texas Comptroller SECO, May 19, 2026', '✔', 'A', 'https://comptroller.texas.gov/programs/seco/funding/ira/'],
  ['Oncor Home Energy Efficiency Program', 'Active', 'Incentives for HVAC replacements delivered through participating contractors (Take A Load Off, Texas). Amounts are set per program year and not published on the landing page; contractors enroll as service providers.', 'Oncor', '✔', 'B', 'https://www.oncor.com/content/oncorwww/talot/en/home/residential.html'],
  ['Oncor Low-Income Weatherization', 'Active', 'Low or no cost upgrades, including HVAC, for income-qualified customers through service providers.', 'Oncor', '✔', 'B', 'https://www.oncor.com/content/oncorwww/talot/en/home/residential.html'],
  ['Co-op and municipal utilities', 'Varies', 'CoServ, Farmers Electric Cooperative, Denton Municipal Electric and Garland Power and Light serve parts of the study area outside Oncor and run their own rebate lists. Not verified for this build.', 'Utility websites', '◐', 'D', ''],
  ['Atmos Energy (gas)', 'None found', 'No residential furnace rebate identified for the Mid-Tex division.', 'Atmos Energy', '◐', 'D', ''],
  ['Manufacturer and distributor promotions', 'Seasonal', 'Factory rebates and 0% financing windows change quarterly and carry Reg Z disclosure duties when advertised (module 10).', 'Brand programs', '◐', 'C', ''],
];
const STANDARDS = [
  ['Split air conditioner, South region', '14.3 SEER2 below 45,000 Btu/h; 13.8 SEER2 at or above', 'Since Jan 1, 2023', 'Installed units must meet the regional floor; installers carry the compliance duty.', '◐', 'B'],
  ['Split heat pump, national', '14.3 SEER2 and 7.5 HSPF2', 'Since Jan 1, 2023', 'Applies everywhere; heat pumps have no regional variation.', '◐', 'B'],
  ['Non-weatherized gas furnace', '80% AFUE today; 95% AFUE on Dec 18, 2028', 'In litigation and petition', 'Supreme Court remand June 8, 2026; delay petition to 2030 published April 27, 2026.', '✔', 'A'],
  ['Refrigerant, new residential split systems', 'GWP 700 or below (A2L: R454B, R32)', 'Manufacture since Jan 1, 2025', 'Pre-2025 R410A stock may still be installed after the May 26, 2026 final rule.', '✔', 'B'],
  ['Window and room units', 'Final date of sale three years after the manufacture date, no later than Jan 1, 2028', 'Per May 2026 rule', 'Relevant to the 10.6% of Texas cooling households on window or wall units (RECS 2020).', '✔', 'B'],
];
const LICENSE = [
  ['Air conditioning and refrigeration contractor license', 'Texas Occupations Code chapter 1302; 16 TAC chapter 75', 'Class A (any size) and Class B (up to 25 tons cooling and 1.5 million Btu/h heating), with Environmental Air, Commercial Refrigeration, or both endorsements.', '◐'],
  ['Advertising must carry the license number', '16 TAC §75.71(h)', '"All advertising by air conditioning and refrigeration contracting companies designed to solicit air conditioning or refrigeration business must include the affiliated licensee\'s license number."', '✔'],
  ['Vehicles', '16 TAC §75.71(g)', 'License number of the affiliated licensee and company name in letters not less than two inches high on both sides of every vehicle used for the work.', '✔'],
  ['Proposals and invoices', '16 TAC §75.71(i)', 'Company name, address, phone and license number on all proposals and invoices, plus the TDLR notice: Regulated by The Texas Department of Licensing and Regulation, P.O. Box 12157, Austin, Texas 78711, 1-800-803-9202, 512-463-6599.', '✔'],
  ['Technicians', 'Occupations Code chapter 1302', 'Anyone working under a licensee must hold a technician registration or certification; certified technicians have passed the exam.', '◐'],
  ['Refrigerant handling', 'EPA, 40 CFR Part 82 Subpart F (Section 608)', 'Technicians who open refrigerant circuits must hold Section 608 certification; venting is prohibited.', '◐'],
  ['City mechanical permits', 'Municipal mechanical codes (Dallas, Fort Worth, Irving and most DFW cities)', 'Changeouts require a mechanical permit and inspection; all three city files in this atlas record them as "replace or modify existing HVAC" or standalone mechanical permits.', '✔'],
];
registerModule({
  key: 'rules', num: '03', title: 'Rules and Refrigerants', desc: 'R22 to A2L, SEER2, the furnace rule, lapsed credits, rebates, TDLR licensing and permits',
  mount(root) {
    const st = { layer: 'r22_sh', sel: null };
    const T = META.tdlr; const C = META.cal;
    root.innerHTML = mastHTML({ eyebrow: 'Module 03 · Rules and Refrigerants', title: 'Rules and Refrigerants', dek: 'The rules that set what a DFW replacement costs and when it happens: the refrigerant clock from R22 to A2L, the SEER2 floors, the condensing furnace rule now in the courts, the federal credits that lapsed on December 31, 2025, the Texas rebates that have not launched, the utility programs that have, and the TDLR and city rules every contractor ad and invoice must follow.',
      meta: [`<b>${N(META.r22)}</b> R22 era systems still running`, `<b>${N(META.lic_con_dfw)}</b> active ACR contractor licenses in the 12 counties`, `<b>${N(META.lic_tech_dfw)}</b> active technician licenses`, '<b>Policy vintage</b> fetched September 25, 2026'],
      bar: 'Rules and Refrigerants', barsub: 'Policy calendar 2010 to 2036 · every row marked ✔ read this build or ◐ secondary or memory',
      actions: [{ id: 'p3Csv', label: '↓ Policy calendar CSV' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: why the rules are the biggest lever on a ticket', `Three rule changes land on every DFW replacement in 2026. The refrigerant: new split systems have shipped on A2L refrigerants since January 2025, an A2L condenser needs an A2L-rated coil, and ${N(META.r22)} systems in the metro still run R22, which has not been made since 2020. The money: the federal 25C credit (up to $2,000 for a heat pump, $600 for a central AC or furnace) ended with 2025, Texas has not launched its $690 million rebate programs, and equipment prices rose twice in 2026. The paperwork: TDLR requires the license number on <b>every</b> advertisement and both sides of every truck, and city permits are required for changeouts but, by this atlas's own count, pulled for about one in five (${P(C.Dallas.cap * 100, 0)} Dallas, ${P(C['Fort Worth'].cap * 100, 0)} Fort Worth, ${P(C.Irving.cap * 100, 0)} Irving). ✔ marks a primary text read for this build; ◐ marks a secondary source or memory that must be verified before it appears in a finding.`)}
      <div class="kpis" id="p3Kpis"></div>
      ${card('The refrigerant clock, 2010 to 2036', 'Each marker is a rule date. The line is the AIM Act HFC allocation as a share of baseline; the shaded band is where the installed base sits today.', '<div id="p3Clock"></div><p class="chartnote" id="p3ClockN"></p>', 'mt')}
      <div class="grid2">
        <div class="card mapcard"><div class="card-h" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h3 style="flex:1">Where the rules bite</h3><select id="p3Layer"><option value="r22_sh">R22 era systems still running (%)</option><option value="furn20_sh">Gas furnaces 20 years or older (%)</option><option value="gas_sh">Gas-heated homes, furnace rule exposure (%)</option><option value="hp_sh">Heat pump share, rebate relevance (%)</option></select></div><div id="p3Map"></div><div class="legend" id="p3Leg"></div></div>
        <div class="stack">${card('Installed base by refrigerant era', 'Model estimate from equipment age.', '<div id="p3Era"></div>')}${card('What the rules mean for a contractor', 'Five readings, each tied to a number on this page.', '<div id="p3Read"></div>')}</div>
      </div>
      ${card('Policy calendar, 2010 to 2036', 'Every dated rule change behind the numbers in this atlas, with its source and its vintage.', '<div class="tscroll tall" id="p3Cal"></div>', 'mt')}
      <div class="split">
        ${card('Efficiency and refrigerant standards in force', 'DOE and EPA floors that apply to equipment installed in Texas.', '<div id="p3Std"></div>')}
        ${card('Incentives: what is live and what lapsed', 'Every program an ad or proposal might mention, with its status on September 25, 2026.', '<div id="p3Inc"></div>')}
      </div>
      <div class="split">
        ${card('Licensing, advertising and permits', 'Texas Department of Licensing and Regulation rules that bind every ad, truck and invoice, and the city permit layer.', '<div id="p3Lic"></div>')}
        ${card('Licensed supply by county', 'Active TDLR licenses (expiring on or after September 25, 2026), per 10,000 households.', '<div class="tscroll short" id="p3Tdlr"></div>')}
      </div>
      <div class="split">
        ${card('Judgment calls', 'Where this module had to choose.', '<div id="p3Judg"></div>')}
        ${card('Source register', '', '<div id="p3Src"></div>')}
      </div>
      <div class="foot">DFW Thermal Debt Atlas, module 03. Policy research material, not legal advice. Section numbers change and rules get vacated; a wrong cite is worse than no cite, so fetch the live text before relying on a ◐ row.</div></div>`;
    $('#p3Kpis', root).innerHTML = kpiHTML([
      { l: 'R22 era systems', g: 'B', v: K(META.r22), d: `${P(META.r22 / META.sys * 100, 1)} of the installed base, installed before 2010` },
      { l: 'Federal credit', g: 'A', v: 'Ended', d: '25C lapsed for property placed in service after Dec 31, 2025' },
      { l: 'Texas rebates', g: 'A', v: '$0', d: 'HOMES and HEAR still in design as of May 19, 2026' },
      { l: 'Equipment prices, 2026', g: 'C', v: 'Up to 10%', d: 'two Trane increases of up to 5% each (April, July)' },
      { l: 'Permits pulled', g: 'B', v: P((C.Dallas.cap + C['Fort Worth'].cap + C.Irving.cap) / 3 * 100, 0), d: 'of modeled changeouts, three city files' },
      { l: 'Licensed contractors', g: 'A', v: N(META.lic_con_dfw), d: `${N(META.lic_conA_dfw)} hold a Class A license` },
    ]);
    // refrigerant clock
    const alloc = [[2010, 100], [2011, 100], [2021, 100], [2022, 90], [2023, 90], [2024, 60], [2028, 60], [2029, 30], [2033, 30], [2034, 20], [2035, 20], [2036, 15]];
    const ds = el('div');
    lineChart($('#p3Clock', root), { series: [{ name: 'HFC allocation, % of baseline', color: cssv('--s1'), pts: alloc, width: 2.4 }], x: { min: 2009, max: 2037, ticks: [2010, 2014, 2018, 2022, 2026, 2030, 2034], fmt: v => v }, y: { min: 0, max: 110, fmt: v => v + '%', label: 'HFC allocation, % of baseline' }, H: 300,
      bands: [{ x0: 2010, x1: 2025, label: 'R410A era installs' }], vlines: [{ x: 2010, label: 'R22 equipment ban' }, { x: 2020, label: 'R22 production ends', dy: 14 }, { x: 2023, label: 'SEER2', dy: 28 }, { x: 2025, label: 'A2L for new splits', dy: 0 }, { x: 2026.4, label: 'R410A install deadline removed', dy: 42 }, { x: 2028.96, label: '95% AFUE (if not delayed)', dy: 14 }], aria: 'refrigerant timeline' });
    $('#p3ClockN', root).innerHTML = `The installed base lags every rule by one equipment life. Systems put in before 2010 run R22; the ${P(META.r22 / META.sys * 100, 0)} still running are the replacement queue the refrigerant clock already paid for. Systems installed 2010 to 2024 run R410A, which stays serviceable but gets dearer each time the allocation steps down (2024, 2029, 2034). Everything installed from 2025 onward is A2L or leftover R410A stock, and after the May 2026 rule the leftovers can be installed until they run out. The allocation line is the AIM Act schedule as a share of the HFC baseline (◐ for the intermediate steps).`;
    // map
    const map = new ZipMap($('#p3Map', root), { onSelect: z => { st.sel = st.sel === z ? null : z; renderMap(); }, onHover: (zip, e) => { const z = ZI[zip]; if (!z || z.occ < 200) return; showTip(`<div class="tt">${z.zip} · ${esc(z.city)}</div>${tipRow('R22 era systems', P(z.r22_sh) + ' (' + N(z.r22) + ')')}${tipRow('Gas furnaces 20+', P(z.furn20_sh))}${tipRow('Gas heat', P(z.gas_sh, 0))}${tipRow('Heat pump share', P(z.hp_sh, 0))}`, e); } });
    function renderMap() { const L = LAYERS[st.layer]; const sc = qScale(ZR.map(z => z[st.layer]), L.ramp, 1); map.fill(zip => { const z = ZI[zip]; return z && z.occ >= 200 ? sc.f(z[st.layer]) : null; }); map.select(st.sel); const v = ZR.map(z => z[st.layer]).filter(isN); $('#p3Leg', root).innerHTML = legendHTML({ title: L.l, R: sc.R, lo: L.f(Math.min(...v)), hi: L.f(Math.max(...v)), note: esc(L.note) + ' ' + G(L.g) }); }
    $('#p3Layer', root).onchange = e => { st.layer = e.target.value; renderMap(); };
    renderMap();
    const recent = META.bands[0] * 0.3;
    $('#p3Era', root).innerHTML = `<div id="p3EraC"></div><p class="chartnote">R22 era is modeled directly (systems whose current age exceeds 16.5 years). The split between R410A and A2L inside the youngest band is an approximation: about three tenths of the 0 to 4 year band, some ${N(recent)} systems, went in after January 2025, when new equipment became A2L but R410A stock still shipped (grade D).</p>`;
    hbarChart($('#p3EraC', root), [{ l: 'R22 era (before 2010)', v: META.r22, color: cssv('--heat') }, { l: 'R410A era (2010 to 2024)', v: META.sys - META.r22 - recent, color: cssv('--s4') }, { l: 'Since 2025 (A2L or leftover R410A)', v: recent, color: cssv('--cool') }], { L: 230, R: 90 });
    $('#p3Read', root).innerHTML = `<ol class="meth">
      <li><b>Sell the R22 queue before summer.</b> ${N(META.r22)} systems cannot be recharged economically; the first leak is the sale. They cluster in the pre-2005 ZIPs on this map.</li>
      <li><b>Quote matched systems.</b> An A2L condenser needs an A2L coil, so the partial swap is gone for new equipment; ${P(DATA.tickets.cls.system / DATA.tickets.n_all * 100, 0)} of Irving's permitted jobs were already full systems before the rule bit.</li>
      <li><b>Take "tax credit" out of every ad.</b> 25C is gone for 2026 installs. The only live money in most of the metro is Oncor's contractor-delivered program; confirm the program year's amounts before quoting them.</li>
      <li><b>Put the license number everywhere.</b> 16 TAC §75.71(h) makes it mandatory on all advertising; the Campaign Desk and Site Forge insert it, and the Satchel fails any asset without it.</li>
      <li><b>Pull the permit.</b> About four in five modeled changeouts leave no permit in the city files. A contractor who permits every job has a verifiable record to advertise, and a competitor who does not has a finding (module 10) that only the city can confirm.</li></ol>`;
    $('#p3Cal', root).innerHTML = `<table class="prose"><thead><tr><th>Date</th><th>Event</th><th>What changed</th><th>Source</th><th>Grade</th></tr></thead><tbody>${RULE_CAL.map(r => `<tr><td style="white-space:nowrap">${r[0]}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])} <span class="mini">${r[4]}</span></td><td>${G(r[5])}</td></tr>`).join('')}</tbody></table>`;
    $('#p3Std', root).innerHTML = proseTable(STANDARDS.map(r => [esc(r[0]), esc(r[1]) + `<div class="mini">${esc(r[2])}</div>`, esc(r[3]) + ` <span class="mini">${r[4]}</span> ` + G(r[5])]), ['Equipment', 'Floor', 'Note']);
    $('#p3Inc', root).innerHTML = proseTable(INCENTIVES.map(r => [r[6] ? `<a href="${r[6]}" target="_blank" rel="noopener">${esc(r[0])}</a>` : esc(r[0]), `<span class="pill">${esc(r[1])}</span>`, esc(r[2]) + ` <span class="mini">${esc(r[3])} ${r[4]}</span> ` + G(r[5])]), ['Program', 'Status', 'Detail']);
    $('#p3Lic', root).innerHTML = proseTable(LICENSE.map(r => [esc(r[0]), `<span class="mono">${esc(r[1])}</span>`, esc(r[2]) + ` <span class="mini">${r[3]}</span>`]), ['Rule', 'Where', 'Text or summary']);
    dataTable($('#p3Tdlr', root), [{ k: 'name', h: 'County', l: 1 }, { k: 'lic_con', h: 'Contractors', f: v => N(v) }, { k: 'lic_conA', h: 'Class A', f: v => N(v) }, { k: 'lic_tech', h: 'Technicians', f: v => N(v) }, { k: 'lic_cert', h: 'Certified', f: v => N(v) }, { k: 'per10k_con', h: 'Contractors per 10k hh', f: v => D(v, 1) }, { k: 'sys_per_tech', h: 'Systems per tech', f: v => N(v) }], CO, { sortKey: 'lic_con' });
    $('#p3Judg', root).innerHTML = judgList([
      ['Business county, not job county', 'TDLR licenses are counted by the business county on the license (mailing county where blank). A Collin County shop that works Dallas County counts in Collin.'],
      ['Active means unexpired', `A license counts if it expires on or after September 25, 2026. The public file carries recently expired licenses too: ${N(T.con)} of the statewide contractor rows and ${N(T.tech)} technician rows pass that test.`],
      ['R22 era is an age cut', 'Systems older than 16.5 years in mid 2026 were installed before 2010 and treated as R22. A few dry-charged R22 condensers went in after 2010 and a few early R410A units before; the error is small in both directions.'],
      ['Incentive amounts are not quoted', 'Oncor publishes program amounts per program year through its contractor portal. The atlas states the program exists and leaves the dollar figure to the program manual.'],
      ['◐ rows stay out of findings', 'Any rule marked ◐ is from memory or a secondary source. The Emergency Satchel will not CONFIRM a finding on a ◐ rule.']]);
    $('#p3Src', root).innerHTML = srcRows([
      ['25C termination', 'IRS, Energy Efficient Home Improvement Credit', 'A', 'read Sep 25, 2026', 'https://www.irs.gov/credits-deductions/energy-efficient-home-improvement-credit'],
      ['R410A installation rule', 'NAHB, EPA Finalizes Refrigerant Rule Update to Allow Older HVAC Unit Installation', 'B', 'May 2026', 'https://www.nahb.org/blog/2026/05/epa-hvac-refrigerants-r-410a-final-rule'],
      ['Furnace standard', 'Federal Register, Notification of Petition for Rulemaking (2026-08145); ACHR News on the Supreme Court remand', 'A/B', 'Apr to Jun 2026', 'https://www.govinfo.gov/content/pkg/FR-2026-04-27/pdf/2026-08145.pdf'],
      ['Texas rebates', 'Texas Comptroller, SECO, IRA home energy rebates', 'A', 'May 19, 2026', 'https://comptroller.texas.gov/programs/seco/funding/ira/'],
      ['Oncor programs', 'Oncor, Take A Load Off, Texas: Residential', 'B', '2026', 'https://www.oncor.com/content/oncorwww/talot/en/home/residential.html'],
      ['TDLR advertising, vehicles, invoices', '16 Tex. Admin. Code §75.71 (Cornell LII mirror of the TAC)', 'A', 'read Sep 25, 2026', 'https://www.law.cornell.edu/regulations/texas/16-Tex-Admin-Code-SS-75-71'],
      ['License counts', 'Texas Open Data Portal, TDLR All Licenses (7358-krk7), A/C Contractor and A/C Technician', 'A', 'Sep 25, 2026', 'https://data.texas.gov/resource/7358-krk7'],
      ['Price increases', 'ACHR News, Sep 18, 2026', 'C', 'Sep 2026', 'https://www.achrnews.com/articles/166689-price-increases-remain-part-of-the-residential-hvac-outlook'],
      ['Texas SB 140', 'Morgan Lewis, Texas Telephone Solicitation Law Now Covers Texts', 'C', 'Sep 2025', 'https://www.morganlewis.com/pubs/2025/09/texas-telephone-solicitation-law-now-covers-text-messages'],
    ]);
    $('#p3Csv', root).onclick = () => saveFile('dfw-hvac-policy-calendar.csv', toCSV(['date', 'event', 'what_changed', 'source', 'vintage', 'grade'], RULE_CAL, 'DFW Thermal Debt Atlas, module 03. Vintage: read this build (✔) or secondary/memory (◐).'));
    BUS.on('theme', () => { renderMap(); });
  }
});
