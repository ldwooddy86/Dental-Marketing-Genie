/* ==== m11_dfw ==== */
"use strict";
/* ============================ Module 11: Dallas Fort Worth (replaces the dental Texas tab) ============================ */
const DFW_INV = [
  ['H1', 'Housing · stock and age', 'U.S. Census Bureau, American Community Survey 2020 to 2024 five year', 'Year built (B25034), median year built (B25035, B25037), tenure by year built and units (B25127, B25036), heating fuel (B25040, B25117), value, income, movers, language', 'ZCTA, place, county; pooled 2020 to 2024', 'Public, bulk file', 'Used: the base of every model; margins of error carried to the survey precision table'],
  ['H2', 'Housing · blocks', 'Census 2020 PL 94-171 redistricting file and the 2020 block to ZCTA relationship file', 'Housing units by block, used to split ZIPs into cities and counties', 'Block', 'Public, bulk file', 'Used: apportioning ZIP estimates to 120 cities and 12 counties'],
  ['H3', 'Housing · new construction', 'Census Building Permits Survey, county annual', 'New single family and total units authorized', 'County, 1990 to 2025', 'Public, bulk file', 'Used: cohort sizes for the builder original model and the housing history chart'],
  ['G1', 'Geography', 'Census TIGER/Line ZCTA, county and road shapes; Gazetteer', 'Boundaries, centroids, land area', '2024 vintage', 'Public, bulk file', 'Used: the offline map'],
  ['E1', 'Equipment · lifetimes', 'EIA Residential Energy Consumption Survey 2020, public use microdata', 'Age bands of the main cooling and heating equipment by year the home was built, with replicate weights', 'Texas (state is the finest geography)', 'Public, bulk file', 'Used: Weibull lifetimes by maximum likelihood with replicate weight standard errors'],
  ['E2', 'Equipment · permits', 'City of Fort Worth open data, development permits (mechanical)', 'Monthly HVAC permits', 'City, 2012 to 2026', 'Public, API', 'Used: heat elasticity, seasonality, capture ratio'],
  ['E3', 'Equipment · permits', 'City of Dallas open data, building permits (mechanical)', 'Monthly HVAC permits', 'City, 2018 to 2026', 'Public, API', 'Used: heat elasticity, capture ratio'],
  ['E4', 'Equipment · permits and values', 'City of Irving open data, permits', 'HVAC permits with declared valuation, tonnage and job class', 'City, 2022 to 2025', 'Public, API', 'Used: full system ticket values, the full system share, capture ratio'],
  ['E5', 'Equipment · permits elsewhere', 'Plano, Arlington, Garland, Frisco, McKinney, Denton and other cities', 'Mechanical permits', 'City', 'Public Information Act request', 'Not used: no open feed found; request under Gov\'t Code ch. 552 to extend the calibration'],
  ['C1', 'Climate · daily', 'NOAA GHCN Daily, DFW International Airport (USW00003927)', 'Daily maximum and minimum temperature', '1954 to Sep 2026', 'Public, bulk file', 'Used: 100 degree days, cooling and heating degree days, cold snaps'],
  ['C2', 'Climate · normals and constants', 'NWS Fort Worth climate pages (carried from the heatmap)', '1991 to 2020 normals, record seasons, design temperatures', 'DFW', 'Public, web', 'Used: North Texas constants table'],
  ['C3', 'Severe weather · hail', 'NOAA Storm Events Database, Texas details files', 'Hail reports with size, place and time', 'Point, 1996 to 2026', 'Public, bulk file', 'Used: ZIP hail exposure within 8 km, county counts, the hail record'],
  ['C4', 'Severe weather · zone events', 'NOAA Storm Events Database, forecast zone events', 'Heat, excessive heat, winter storm and ice storm events', 'NWS zones, 1996 to 2026', 'Public, bulk file', 'Used: event counts by year'],
  ['S1', 'Supply · licensing', 'Texas Open Data Portal, TDLR All Licenses (7358-krk7)', 'A/C contractor and technician licenses with class, county and expiration', 'Statewide, September 2026', 'Public, API', 'Used: licensed supply by county, the Satchel license lookup (owner names and addresses left out)'],
  ['S2', 'Supply · establishments', 'Census County and ZIP Business Patterns, NAICS 238220', 'Plumbing, heating and air conditioning contractor establishments', 'ZIP, 2016 and 2023', 'Public, bulk file', 'Used: establishment density and growth'],
  ['S3', 'Supply · competitors', 'The DFW HVAC heatmap: 242 mapped locations', 'Google Business Profile ratings and review counts, services, brands, promotions; Ahrefs domain metrics captured when the heatmap was built', 'Location, 2026', 'Internal (from the heatmap)', 'Used: competitor pins, review mass, Supply Line. No new Ahrefs pull was made for this atlas'],
  ['S4', 'Supply · wages', 'BLS Occupational Employment and Wage Statistics, HVAC mechanics (49-9021), Dallas MSA', 'Employment and wage percentiles', 'MSA, May 2025', 'Public, web', 'Not used: the BLS site was unreachable from this build; the recruiting pay range is an input'],
  ['A1', 'Advertising · geo targets', 'Google Ads geotargets file', 'Criterion IDs for ZIPs, cities and counties', 'US, 2026', 'Public, bulk file', 'Used: 259 of 277 ZIP IDs in the Campaign Desk exports'],
  ['A2', 'Advertising · costs', 'LocaliQ search advertising benchmarks 2025, home services', 'CPC, CTR and conversion rate for HVAC', 'US', 'Public, web', 'Used: Campaign Desk defaults (grade C)'],
  ['A3', 'Advertising · keyword volumes', 'Google Keyword Planner or a paid tool such as Ahrefs', 'Monthly search volumes and click costs by keyword and location', 'ZIP to metro', 'Paid or account', 'Not used: keyword volumes are stated assumptions. An Ahrefs pull needs your approval every time'],
  ['P1', 'Property · appraisal', 'Dallas, Tarrant, Collin and Denton central appraisal districts', 'Parcel year built, square footage, sometimes the presence of central air', 'Parcel', 'Public, bulk export with terms', 'Not used: no equipment age field; a parcel level year built would sharpen the city splits'],
  ['U1', 'Energy · meters', 'Smart Meter Texas and ERCOT', 'Interval consumption by meter; system load', 'Meter; ERCOT zone', 'Customer authorization (meters); public (system load)', 'Not used: meter data needs each customer\'s consent'],
  ['U2', 'Energy · programs', 'Oncor Take A Load Off, Texas; co-op and municipal utility rebate lists', 'Program rules and participating contractors', 'Utility territory', 'Public, web (rules); private (participation)', 'Used: program status in module 03'],
  ['R1', 'Rules', 'EPA, IRS, DOE, Federal Register, Texas Comptroller SECO, TDLR rules (16 TAC ch. 75)', 'Refrigerant, credit, efficiency, rebate and licensing rules', 'Federal and state', 'Public, web', 'Used: modules 03 and 10'],
];
const DFW_GATES = [
  ['Texas Public Information Act', 'Gov\'t Code ch. 552', 'City permit records that are not on an open data portal are public on request. The city must respond within 10 business days or ask the Attorney General for a ruling; costs follow the AG\'s rules.'],
  ['Census confidentiality', '13 U.S.C. §9', 'Published tables only; no microdata below the survey\'s release geography. ACS margins of error travel with every estimate.'],
  ['RECS geography', 'EIA disclosure rules', 'The public microdata identifies the state, not the metro, which is why equipment lifetimes are fitted for Texas and applied to DFW.'],
  ['Meter data', 'PUC Subst. R. §25.130 (advanced metering)', 'Interval data belongs to the customer; a contractor can see it only with the customer\'s authorization through Smart Meter Texas.'],
  ['Appraisal records', 'Tax Code ch. 25', 'Parcel records are public, but some owners\' addresses are confidential and bulk exports come with terms of use.'],
  ['License data', 'TDLR open data terms', 'Public. This atlas carries license numbers, business names, classes, counties and expirations only; owner names and addresses are left out.'],
  ['Platform data', 'Google, Meta and Yelp terms of service', 'No scraping of platform data; review counts are taken as shown on public profiles and dated.'],
  ['Paid data', 'Ahrefs API terms', 'Paid per pull. The standing rule for this account: ask before every pull, however small.'],
  ['Outbound contact from lists', 'TCPA; Texas Bus. & Com. Code ch. 302 as amended by SB 140', 'Calling or texting homeowners found through any of these datasets needs consent or a registration; the data does not carry consent.'],
];
const DFW_GAPS = [
  ['Equipment age by address', 'No registry records when a system was installed. Permits capture about one job in five, appraisal districts do not record equipment, and RECS is a state sample. The atlas estimates ages by block from build year and fitted lifetimes (grade C).'],
  ['Failures and service calls', 'Call volumes live in contractors\' dispatch systems and distributors\' part sales. The heatmap\'s component table uses a national parts retailer\'s index as a proxy.'],
  ['Prices paid', 'Only Irving publishes declared valuations on HVAC permits, and declared values track contract prices loosely.'],
  ['Permits in most suburbs', 'Fort Worth, Dallas and Irving publish permits; most other cities do not. Each is a Public Information Act request away.'],
  ['Refrigerant by address', 'No public record says which refrigerant a home\'s system uses; the R22 count is an age cut.'],
  ['Hail damage and claims', 'Insurers hold claims; the Texas Department of Insurance publishes aggregates only. Storm reports follow where spotters are, so rural counties are undercounted.'],
  ['Warranty registrations and dealer territories', 'Held by manufacturers.'],
  ['Utility program participation', 'Oncor and the co-ops know which homes took an HVAC rebate; they do not publish it.'],
];
registerModule({
  key: 'dfw', num: '11', title: 'Dallas Fort Worth', desc: 'The 12 counties on their own: stock, climate, hail, housing waves, supply, precision and data access',
  mount(root) {
    const CL = DATA.climate, ci = k => CL.cols.indexOf(k), YTD = CL.ytd, curY = +String(YTD.through).slice(0, 4);
    const PAST = CL.rows.filter(r => r[0] !== curY), CUR = CL.rows.find(r => r[0] === curY);
    const above = PAST.filter(r => r[ci('d100')] > YTD.d100).length, ties = PAST.filter(r => r[ci('d100')] === YTD.d100).map(r => r[0]);
    const REC = PAST.reduce((m, r) => r[ci('d100')] > m[ci('d100')] ? r : m, PAST[0]);
    const HY = DATA.hail.rows, HC = DATA.hail.cols; const hcur = HY.find(r => r[0] === curY) || [curY, 0, 0, 0, 0, 0];
    const fw = META.fw_ytd, fwN = fw[String(curY)], fwP = fw[String(curY - 1)], fwMax = Object.entries(fw).filter(([y]) => +y !== curY).sort((a, b) => b[1] - a[1])[0];
    const fwThrough = 'September 24';
    const cntyArea = {}; Z.forEach(z => { if (z.fips) cntyArea[z.fips] = (cntyArea[z.fips] || 0) + (z.sqmi || 0); });
    const BY = DATA.bps.years, U1 = f => DATA.bps.u1[f] || [];
    const through = new Date(YTD.through + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const LAY = {
      ge15_sh: ['Systems 15 years or older (%)', z => z.ge15_sh, k => 100 * k.ge15 / k.sys, 'ember', 1, v => P(v, 0), 'C'],
      r22_sh: ['R22 era systems (%)', z => z.r22_sh, k => 100 * k.r22 / k.sys, 'ember', 1, v => P(v, 0), 'C'],
      rep_per1k: ['Replacements a year per 1,000 systems', z => z.rep_per1k, k => 1000 * k.rep / k.sys, 'ember', 1, v => D(v, 0), 'C'],
      origwin_sh: ['Builder originals aged 10 to 25 (%)', z => z.origwin_sh, k => 100 * k.orig_win / k.sys, 'ember', 1, v => P(v, 0), 'C'],
      furn20_sh: ['Gas furnaces 20 or older (% of furnaces)', z => z.furn20_sh, k => 100 * k.furn20 / k.furn, 'ember', 1, v => P(v, 0), 'C'],
      gas_sh: ['Gas heated homes (%)', z => z.gas_sh, k => k.gas_sh, 'blue', 1, v => P(v, 0), 'A'],
      medyr: ['Median year built', z => z.medyr, k => k.medyr, 'teal', -1, v => isN(v) ? String(Math.round(v)) : '—', 'A'],
      hail: ['Hail of 1 inch or larger (ZIP: within 8 km since 2016; county: per 100 sq mi)', z => z.hail1_8km, k => 100 * k.hail1_2016 / (cntyArea[k.fips] || 1), 'blue', 1, v => D(v, 1), 'A'],
      lic: ['Contractor licenses per 10,000 households (county)', null, k => k.per10k_con, 'teal', 1, v => D(v, 1), 'A'],
      spt: ['Systems per licensed technician (county)', null, k => k.sys_per_tech, 'ember', 1, v => N(v), 'B'],
      value: ['Median home value ($)', z => z.value, k => k.value, 'teal', 1, v => M$(v), 'A'],
      inc: ['Median household income ($)', z => z.inc, k => k.inc, 'teal', 1, v => M$(v), 'A'],
    };
    const st = { layer: 'ge15_sh', mode: 'zip', sel: null, area: 'dfw', dom: '', acc: '' };
    const headline = (f, k) => [
      ['Occupied housing units', k ? k.occ : META.occ, 'ACS 2020 to 2024', 'A', N],
      ['Central systems in homes (model)', k ? k.sys : META.sys, 'Atlas renewal model on ACS and RECS', 'C', N],
      ['Systems 15 years or older', k ? k.ge15 : META.ge15, 'Atlas renewal model', 'C', N],
      ['Systems 20 years or older', k ? k.ge20 : META.ge20, 'Atlas renewal model', 'C', N],
      ['R22 era systems (installed before 2010)', k ? k.r22 : META.r22, 'Atlas renewal model', 'C', N],
      ['Builder originals aged 10 to 25', k ? k.orig_win : META.orig_win, 'Atlas renewal model on Census BPS cohorts', 'C', N],
      ['Replacements a year, RECS shape', k ? k.rep : META.rep, 'Atlas renewal model', 'C', N],
      ['Replacements a year, engineering shape k = 3', k ? null : META.rep_k3, 'Atlas renewal model, same mean life', 'C', N],
      ['Replacements a year in 2035, RECS shape', k ? (k.fc || [])[9] : META.fc[9], 'Atlas ten year forecast', 'C', N],
      ['Gas furnaces', k ? k.furn : META.furn, 'ACS heating fuel with RECS equipment shares', 'C', N],
      ['Gas furnaces 20 or older', k ? k.furn20 : META.furn20, 'Atlas renewal model', 'C', N],
      ['Replacement dollars a year', k ? k.opp_usd : META.opp_usd, 'Model replacements times Irving ticket values', 'C', MM],
      ['Median year built', k ? k.medyr : META.medyr_msa, 'ACS 2020 to 2024', 'A', v => String(Math.round(v))],
      ['Gas heated homes (%)', k ? k.gas_sh : META.gas_msa, 'ACS 2020 to 2024', 'A', v => P(v, 1)],
      ['Median home value', k ? k.value : META.value_msa, 'ACS 2020 to 2024', 'A', M$],
      ['New single family homes permitted, 2015 to 2025', k ? k.bps_u1_2015_25 : sum(FIPS.map(f => COI[f].bps_u1_2015_25)), 'Census Building Permits Survey', 'A', N],
      ['Hail reports of 1 inch or larger since 2016', k ? k.hail1_2016 : sum(FIPS.map(f => COI[f].hail1_2016)), 'NOAA Storm Events', 'A', N],
      ['Active A/C contractor licenses', k ? k.lic_con : META.lic_con_dfw, 'TDLR license file, Sep 2026', 'A', N],
      ['Active A/C technician licenses', k ? k.lic_tech : META.lic_tech_dfw, 'TDLR license file, Sep 2026', 'A', N],
      ['Systems per licensed technician', k ? k.sys_per_tech : META.sys / META.lic_tech_dfw, 'Model systems over TDLR technicians', 'B', N],
      ['HVAC contractor establishments, 2023', k ? null : META.cbp.e23, 'Census ZIP Business Patterns, NAICS 238220', 'A', N],
      ['100 degree days at DFW Airport, 2026 through ' + through.replace(/, \d{4}$/, ''), k ? null : YTD.d100, 'NOAA GHCN Daily', 'A', N],
      ['Fort Worth HVAC permits, January 1 to ' + fwThrough + ', ' + curY, k ? null : fwN, 'City of Fort Worth open data', 'A', N],
    ].filter(r => isN(r[1]));
    root.innerHTML = mastHTML({ eyebrow: 'Module 11 · Dallas Fort Worth', title: 'Dallas Fort Worth', dek: 'The 12 counties on their own: every heating and cooling number the atlas holds for Dallas Fort Worth. The installed base and its age, the climate record that wears it out, the hail that breaks it, the building booms that set when it will be replaced, the licensed supply that replaces it, how precise each survey estimate is, and every dataset that exists, who holds it and what it takes to get it.',
      meta: [`<b>${CO.length}</b> counties · <b>${N(META.nzip)}</b> ZIPs · <b>${N(CITIES.length)}</b> cities`, `<b>${DFW_INV.length}</b> data sources inventoried`, `Climate through <b>${esc(through)}</b>`, 'A to D grade on every figure · no keyword data pulled'],
      bar: 'Dallas Fort Worth', barsub: 'The metro on its own', actions: [['d11CoX', '↓ Counties'], ['d11ZiX', '↓ ZIPs'], ['d11HlX', '↓ Headlines'], ['d11InvX', '↓ Inventory'], ['d11SvyX', '↓ Survey estimates'], ['d11Desk', 'Campaign Desk ↗'], ['d11Forge', 'Site Forge ↗']].map(([id, label]) => ({ id, label })) }) +
      `<div class="wrap">
      ${callout('', 'Read this first: how to read Dallas Fort Worth', `An estimated <b>${N(META.sys)}</b> central systems serve the metro's ${N(META.occ)} occupied homes. <b>${N(META.ge15)}</b> are 15 or older and <b>${N(META.r22)}</b> were installed before 2010, when R22 ended in new equipment. At the Texas lifetimes fitted to RECS, the stock turns over about <b>${N(META.rep)}</b> systems a year, rising to ${N(META.fc[9])} by 2035 as the ${N(BOOM1)} single family homes permitted from 2000 to 2006 pass through their first and second replacements and the ${N(BOOM2)} permitted from 2020 to 2024 wait behind them. The median home was built in ${META.medyr_msa}, against ${META.medyr_us} nationally, so DFW is young by national standards and old by the equipment's. The climate is the accelerant: ${YTD.d100} days at 100 degrees or more at DFW Airport in ${curY} through ${esc(through.replace(/, \d{4}$/, ''))}, against ${D(YTD.norm_d100, 0)} in a normal year. Replacement permits in Fort Worth run ${S((fwN / fwP - 1) * 100, 0)}% on ${curY - 1} for January 1 to ${fwThrough}. Every figure here is a survey estimate, a model output or an administrative count and says which, with a grade.`)}
      <div class="kpis" id="d11Kpis"></div>
      <div class="controls"><div class="ctl"><label class="fl" for="d11Lay">Layer</label><select id="d11Lay">${Object.entries(LAY).map(([k, v]) => `<option value="${k}">${esc(v[0])}</option>`).join('')}</select></div><div class="ctl"><label class="fl">Show</label><div class="seg" id="d11Mode"><button data-v="zip" aria-pressed="true">ZIPs</button><button data-v="county" aria-pressed="false">Counties</button></div></div><div class="ctl"><label class="fl">&nbsp;</label><button class="btn sec sm" id="d11Reset">Reset</button></div></div>
      <div class="grid2"><div class="card mapcard"><div id="d11Map"></div><div class="legend" id="d11Leg"></div></div><div class="card"><div class="card-h"><h3 id="d11LedT">Dallas Fort Worth</h3><p id="d11LedS">Click a county or ZIP for its ledger.</p></div><div class="card-b" id="d11Led"></div></div></div>

      <div class="split">
        ${card('The heat record: days at 100 degrees or more', `DFW Airport, ${CL.rows[0][0]} to ${curY}. ${curY} is highlighted and runs through ${esc(through.replace(/, \d{4}$/, ''))}; the dashed line is the 1991 to 2020 normal of ${D(YTD.norm_d100, 1)}.`, '<div id="d11D100"></div><p class="chartnote" id="d11D100N"></p>')}
        ${card('Cooling and heating demand by year', 'Cooling and heating degree days at DFW Airport, base 65°F, with ten year rolling means. The current year is partial and left off the lines.', '<div id="d11Cdd"></div><div id="d11Hdd" class="mt"></div>')}
      </div>
      <div class="split">
        ${card('Where the year stands', `${curY} through ${esc(through.replace(/, \d{4}$/, ''))} against the normal for the same dates, and the extremes of the record.`, '<div id="d11Ytd"></div>')}
        ${card('The monthly shape', 'Normal cooling and heating degree days by month. Replacement demand follows the cooling curve with a lag; heating calls cluster in the few weeks of the year that fall below freezing.', '<div id="d11Mon"></div>')}
      </div>
      <div class="split">
        ${card('Housing waves: when the systems went in', 'New single family homes permitted by county, 1990 to 2025, and the same homes fifteen years later, when half their original systems have been replaced (line). The line runs to 2040.', '<div id="d11Bps"></div><div id="d11BpsL"></div>')}
        ${card('The hail record', 'Hail reports in the 12 counties by size, 1996 to ' + curY + '. Reports follow spotters, so they rise with population; sizes are the largest stone reported.', '<div id="d11Hail"></div><div id="d11HailL"></div>')}
      </div>
      <div class="split">
        ${card('Dallas Fort Worth against Texas and the nation', 'ACS 2020 to 2024. The metro is newer, more electric and richer than the country, which is why its systems are heat pumps and electric strip heat as often as gas furnaces.', '<div id="d11Cmp"></div>')}
        ${card('The biggest hail since 2016', 'Largest stones reported, NOAA Storm Events.', '<div class="tscroll short" id="d11Big"></div>')}
      </div>
      ${card('County profiles', 'Sortable. Systems and ages are model outputs (grade C); housing, fuel and money are ACS (grade A); licenses are the TDLR file (grade A).', '<div class="tscroll" id="d11Cty"></div>', 'mt')}
      <div class="split">
        ${card('Survey precision: every estimate with its sampling error', 'ACS margins of error at 90% confidence, converted to standard errors and coefficients of variation, and the RECS lifetime fits with replicate weight standard errors. Where the interval is wide, the bound is the finding.', '<div class="tscroll short" id="d11Svy"></div>')}
        ${card('North Texas constants', 'Carried from the heatmap with their sources and grades.', '<div class="tscroll short" id="d11Nt"></div>')}
      </div>
      <div class="split">
        ${card('What fails: component shares', 'Carried from the heatmap. Part orders are a proxy for failures, not a share of service calls.', '<div class="tscroll short" id="d11Comp"></div>')}
        ${card('Severe weather events by year', 'NOAA Storm Events zone reports for the forecast zones covering the 12 counties.', '<div class="tscroll short" id="d11Zone"></div>')}
      </div>
      <div class="card mt"><div class="card-h"><h3>Headline figures</h3><p>Every number this module states, with its source and grade.</p></div><div class="card-b"><div class="controls" style="margin-top:0"><div class="ctl"><label class="fl" for="d11Area">Area</label><select id="d11Area"><option value="dfw">Dallas Fort Worth, 12 counties</option>${CO.map(c => `<option value="${c.fips}">${esc(c.name)} County</option>`).join('')}</select></div></div><div class="xscroll mt" id="d11Hls"></div></div></div>
      <div class="card mt"><div class="card-h"><h3>Data inventory</h3><p>What exists for DFW heating and cooling, who holds it, what it contains and what it takes to get it.</p></div><div class="card-b"><div class="controls" style="margin-top:0"><div class="ctl"><label class="fl" for="d11Dom">Domain</label><select id="d11Dom"><option value="">All</option></select></div><div class="ctl"><label class="fl" for="d11Acc">Access</label><select id="d11Acc"><option value="">All</option></select></div></div><div class="xscroll mt" id="d11Inv"></div></div></div>
      <div class="split">
        ${card('Legal and access gates', 'The rules that decide what leaves each custodian, and the route when nothing is posted.', proseTable(DFW_GATES.map(g => [`<b>${esc(g[0])}</b>`, esc(g[1]), esc(g[2])]), ['Gate', 'Authority', 'What it means here']))}
        ${card('Gaps: what no public dataset fills', 'Where the inventory ends, and why.', judgList(DFW_GAPS.map(g => [esc(g[0]), esc(g[1])])))}
      </div>
      <div class="split">
        ${card('How this tab is built', '', judgList([
          ['Scope', 'Collin, Dallas, Denton, Ellis, Hood, Hunt, Johnson, Kaufman, Parker, Rockwall, Tarrant and Wise counties: the Dallas Fort Worth metro core and its growth ring. 277 ZIP code tabulation areas, 263 with enough homes to score.'],
          ['Stock and age', 'ACS year built by tenure and structure type sets how many homes of each vintage exist in each ZIP; Census permits size the builder cohorts; a renewal process with Weibull lifetimes fitted to RECS 2020 Texas ages each vintage forward to 2026 and counts the replacements.'],
          ['Cities and counties', 'Every ZIP figure is split to cities and counties by the 2020 housing units in its census blocks.'],
          ['Climate', 'Daily maximum and minimum temperature at DFW Airport; degree days on a 65°F base; the normal is the station\'s 1991 to 2020 average for the same dates.'],
          ['Hail', 'NOAA Storm Events hail reports, 1996 onward, counted by county and within 8 km of each ZIP centroid since 2016.']]))}
        ${card('Caveats', '', judgList([
          ['Pooled survey years', 'ACS five year estimates pool 2020 to 2024; a ZIP that grew fast since 2022 is understated.'],
          ['One station', 'DFW Airport stands for the metro. Downtown Dallas and Fort Worth run hotter at night; the western counties are drier.'],
          ['Reported ages', 'RECS ages are what respondents believed; rounding flattens the lifetime curve, which is why module 02 shows steeper engineering shapes beside the fit.'],
          ['Licenses by business county', 'A license counts where its business address is. Large contractors licensed in one county work across all twelve.'],
          ['Permits undercount work', 'About one modeled replacement in five appears as a permit in the three cities that publish them.']]))}
      </div>
      <div class="card mt"><div class="card-h"><h3>Sources</h3></div><div class="card-b">${srcRows([
        ['Housing, fuel, money', 'U.S. Census Bureau, ACS 2020 to 2024 five year summary file', 'A', '2024', 'https://www2.census.gov/programs-surveys/acs/summary_file/2024/'],
        ['Blocks and relationships', 'Census 2020 PL 94-171 and the block to ZCTA relationship file', 'A', '2020', 'https://www2.census.gov/geo/docs/maps-data/data/rel2020/'],
        ['New construction', 'Census Building Permits Survey, county annual', 'A', '1990 to 2025', 'https://www2.census.gov/econ/bps/County/'],
        ['Establishments', 'Census ZIP Business Patterns, NAICS 238220', 'A', '2016, 2023', 'https://www2.census.gov/programs-surveys/cbp/datasets/'],
        ['Climate', 'NOAA GHCN Daily, USW00003927', 'A', through, 'https://www.ncei.noaa.gov/pub/data/ghcn/daily/by_station/'],
        ['Normals and records', 'NWS Fort Worth, DFW climate', 'A', '1991 to 2020 normals', 'https://www.weather.gov/fwd/dfwannual'],
        ['Hail and zone events', 'NOAA Storm Events Database', 'A', '1996 to 2026', 'https://www.ncei.noaa.gov/stormevents/'],
        ['Equipment lifetimes', 'EIA RECS 2020 public use microdata', 'B', '2020', 'https://www.eia.gov/consumption/residential/data/2020/'],
        ['Licenses', 'Texas Open Data Portal, TDLR All Licenses', 'A', 'Sep 2026', 'https://data.texas.gov/resource/7358-krk7'],
        ['Permits', 'City of Fort Worth, City of Dallas and City of Irving open data portals', 'B', 'through ' + fwThrough + ' ' + curY, ''],
        ['Component failures', 'National HVAC Parts, 2026 Parts Failure Index (via the heatmap)', 'C', '2026', 'https://nationalhvacparts.com/blogs/news/2026-hvac-parts-failure-index']])}</div></div>
      </div>`;

    /* ---------- KPIs ---------- */
    $('#d11Kpis', root).innerHTML = kpiHTML([
      { l: 'Central systems', g: 'C', v: K(META.sys), d: `in ${N(META.occ)} occupied homes` },
      { l: '15 years or older', g: 'C', v: P(100 * META.ge15 / META.sys, 0), d: `${N(META.ge15)} systems` },
      { l: 'R22 era', g: 'C', v: K(META.r22), d: 'installed before 2010' },
      { l: 'Replacements a year', g: 'C', v: K(META.rep), d: `${N(META.fc[9])} by 2035` },
      { l: `100 degree days, ${curY}`, g: 'A', v: String(YTD.d100), d: `normal ${D(YTD.norm_d100, 0)}; ${above === 0 ? 'the most' : 'rank ' + (above + 1)} since ${CL.rows[0][0]}${ties.length ? ' (tied)' : ''}` },
      { l: `Hail reports, ${curY}`, g: 'A', v: N(hcur[1]), d: `${N(hcur[3])} of 1.75 inches or more; largest ${D(hcur[5], 2).replace(/0$/, '')} in` },
      { l: 'Licensed contractors', g: 'A', v: N(META.lic_con_dfw), d: `${N(META.lic_tech_dfw)} technicians, ${N(META.sys / META.lic_tech_dfw)} systems each` }]);

    /* ---------- map and ledger ---------- */
    const map = new ZipMap($('#d11Map', root), { onSelect: zip => { const z = ZI[zip]; if (!z) return; if (st.mode === 'county') { st.sel = st.sel === 'c:' + z.fips ? null : 'c:' + z.fips; } else st.sel = st.sel === zip ? null : zip; renderMap(); renderLedger(); },
      onHover: (zip, e) => { const z = ZI[zip]; if (!z) return; const L = LAY[st.layer]; const k = COI[z.fips]; const zv = L[1] ? L[1](z) : null; showTip(`<div class="tt">${st.mode === 'county' ? esc(z.cty) + ' County' : z.zip + ' · ' + esc(z.city)}</div>${st.mode === 'zip' && isN(zv) ? tipRow('ZIP', L[5](zv)) : ''}${k ? tipRow(esc(z.cty) + ' County', L[5](L[2](k))) : ''}`, e); } });
    function renderMap() {
      const L = LAY[st.layer]; const useZip = st.mode === 'zip' && L[1];
      const vals = useZip ? ZR.map(L[1]) : CO.map(L[2]); const q = qScale(vals, L[3], L[4]);
      map.fill(zip => { const z = ZI[zip]; if (!z) return null; if (useZip) return z.occ >= 200 ? q.f(L[1](z)) : null; const k = COI[z.fips]; return k ? q.f(L[2](k)) : null; });
      if (st.sel && st.sel.startsWith('c:')) { const f = st.sel.slice(2); map.dim(new Set(Z.filter(z => z.fips === f).map(z => z.zip))); map.select(null); } else { map.dim(null); map.select(st.sel); }
      $('#d11Leg', root).innerHTML = legendHTML({ title: L[0] + (st.mode === 'zip' && !L[1] ? ', county values' : ''), R: q.R, lo: L[5](L[4] === -1 ? q.hi : q.lo), hi: L[5](L[4] === -1 ? q.lo : q.hi), note: G(L[6]) });
    }
    function renderLedger() {
      const host = $('#d11Led', root);
      if (!st.sel) { $('#d11LedT', root).textContent = 'Dallas Fort Worth'; $('#d11LedS', root).textContent = 'Click a county or ZIP for its ledger.'; host.innerHTML = ledgerRows(null); return; }
      if (st.sel.startsWith('c:')) { const k = COI[st.sel.slice(2)]; $('#d11LedT', root).textContent = k.name + ' County'; $('#d11LedS', root).textContent = `${N(k.nzip)} ZIPs · ${N(k.pop)} residents`; host.innerHTML = ledgerRows(k); return; }
      const z = ZI[st.sel]; $('#d11LedT', root).textContent = z.zip + ' · ' + z.city; $('#d11LedS', root).textContent = `${z.cty} County · ${N(z.occ)} occupied homes`;
      host.innerHTML = [['Central systems', N(z.sys), 'C'], ['15 years or older', P(z.ge15_sh, 0) + ' · ' + N(z.ge15), 'C'], ['R22 era', P(z.r22_sh, 0) + ' · ' + N(z.r22), 'C'], ['Builder originals 10 to 25', P(z.origwin_sh, 0), 'C'], ['Replacements a year', N(z.rep) + ' · ' + D(z.rep_per1k, 0) + ' per 1,000', 'C'], ['Gas furnaces 20 or older', P(z.furn20_sh, 0), 'C'], ['Heat pump share', P(z.hp_sh, 0), 'C'], ['Median year built', isN(z.medyr) ? Math.round(z.medyr) + ' ± ' + D(z.moe_medyr, 0) : '—', 'A'], ['Gas heated homes', P(z.gas_sh, 0), 'A'], ['Median value', M$(z.value) + ' ± ' + M$(z.moe_value), 'A'], ['Median income', M$(z.inc) + ' ± ' + M$(z.moe_inc), 'A'], ['Owner single family', P(z.own_sf_sh, 0), 'A'], ['Hail of 1 inch within 8 km since 2016', N(z.hail1_8km), 'A'], ['HVAC establishments within 8 km', N(z.est_8km), 'A'], ['Thermal Debt Index', isN(z.idx) ? D(z.idx, 0) : '—', 'C'], ['Paid tier', z.tier || '—', 'C']].map(([l, v, g]) => `<div class="rowl"><span>${l} ${G(g)}</span><b>${v}</b></div>`).join('') + `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn sec sm" id="d11ZRep">Replacement Wave ↗</button><button class="btn sec sm" id="d11ZDesk">Campaign Desk ↗</button></div>`;
      $('#d11ZRep', host).onclick = () => goModule('replace', { zip: z.zip }); $('#d11ZDesk', host).onclick = () => goModule('desk', { zips: [z.zip] });
    }
    function ledgerRows(k) { return headline(null, k).map(r => `<div class="rowl"><span>${esc(r[0])} ${G(r[3])}</span><b>${r[4](r[1])}</b></div>`).join(''); }
    $('#d11Lay', root).onchange = e => { st.layer = e.target.value; renderMap(); };
    wireSeg($('#d11Mode', root), v => { st.mode = v; st.sel = null; renderMap(); renderLedger(); });
    $('#d11Reset', root).onclick = () => { st.sel = null; map.reset(); renderMap(); renderLedger(); };

    /* ---------- charts ---------- */
    function renderCharts() {
      const yrs = CL.rows.map(r => r[0]);
      barChart($('#d11D100', root), { cats: yrs.map(String), series: [{ name: 'Days at 100°F or more', color: cssv('--heat'), values: CL.rows.map(r => r[ci('d100')]) }], highlight: i => yrs[i] === curY ? cssv('--ink-2') : null, maxLabels: 12, H: 260, aria: '100 degree days by year', vlabel: [{ i: yrs.indexOf(REC[0]), y: REC[ci('d100')], t: String(REC[0]) }, { i: yrs.indexOf(curY), y: YTD.d100, t: String(curY) }] });
      const svg = $('#d11D100 svg', root); if (svg) { const vb = svg.viewBox.baseVal; const Hh = vb.height, B = 40, T = 16; const mx = Math.max(...CL.rows.map(r => r[ci('d100')])); const yt = niceTicks(0, mx, 5); const y1 = yt[yt.length - 1]; const y = Hh - B - (Hh - B - T) * YTD.norm_d100 / y1; svg.appendChild(svgEl('line', { x1: 58, x2: vb.width - 16, y1: y, y2: y, stroke: cssv('--ink-2'), 'stroke-dasharray': '5 4', 'stroke-width': 1.2 })); svg.appendChild(svgEl('text', { x: 64, y: y - 5, class: 'lblm', 'text-anchor': 'start' }, 'normal ' + D(YTD.norm_d100, 1))); }
      $('#d11D100N', root).textContent = `${curY} has ${YTD.d100} days through ${through.replace(/, \d{4}$/, '')}, ${above === 0 ? 'already the most' : 'already the ' + ['', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][above] + ' highest'} in the record${ties.length ? ', tied with ' + ties.join(' and ') : ''}. The record is ${REC[ci('d100')]} in ${REC[0]}; ${curY - 1} had ${(CL.rows.find(r => r[0] === curY - 1) || [])[ci('d100')]}.`;
      const roll = (k) => { const out = []; const rows = PAST; rows.forEach((r, i) => { if (i < 9) return; const w = rows.slice(i - 9, i + 1).map(x => x[ci(k)]); out.push([r[0], mean(w)]); }); return out; };
      lineChart($('#d11Cdd', root), { series: [{ name: 'Cooling degree days', color: cssv('--heat'), pts: PAST.map(r => [r[0], r[ci('cdd')]]), width: 1.2 }, { name: 'Ten year mean', color: cssv('--heat'), pts: roll('cdd'), width: 2.6 }], y: { fmt: v => N(v), label: 'Cooling degree days' }, x: { fmt: v => v }, H: 220, aria: 'cooling degree days' });
      lineChart($('#d11Hdd', root), { series: [{ name: 'Heating degree days', color: cssv('--cool'), pts: PAST.map(r => [r[0], r[ci('hdd')]]), width: 1.2 }, { name: 'Ten year mean', color: cssv('--cool'), pts: roll('hdd'), width: 2.6 }], y: { fmt: v => N(v), label: 'Heating degree days' }, x: { fmt: v => v }, H: 200, aria: 'heating degree days' });
      const cold = PAST.slice().sort((a, b) => a[ci('tmin')] - b[ci('tmin')]).slice(0, 5), hot = PAST.slice().sort((a, b) => b[ci('tmax')] - a[ci('tmax')]).slice(0, 5);
      $('#d11Ytd', root).innerHTML = proseTable([
        [`Days at 100°F or more`, `<b>${YTD.d100}</b>`, D(YTD.norm_d100, 1), S(YTD.d100 - YTD.norm_d100, 0)],
        ['Cooling degree days', `<b>${N(YTD.cdd)}</b>`, N(YTD.norm_cdd), S((YTD.cdd / YTD.norm_cdd - 1) * 100, 0) + '%'],
        ['Heating degree days', `<b>${N(YTD.hdd)}</b>`, N(YTD.norm_hdd), S((YTD.hdd / YTD.norm_hdd - 1) * 100, 0) + '%'],
        ['Hottest reading', `<b>${D(CUR[ci('tmax')], 0)}°F</b>`, '', ''], ['Coldest reading', `<b>${D(CUR[ci('tmin')], 0)}°F</b>`, '', '']], [`${curY} to date`, 'Value', 'Normal', 'Difference'])
        + `<div class="dsec" style="margin-top:12px">Extremes of the record</div>` + proseTable(hot.map((r, i) => [String(r[0]), D(r[ci('tmax')], 0) + '°F', cold[i] ? String(cold[i][0]) : '', cold[i] ? (cold[i][ci('tmin')] < 0 ? D(-cold[i][ci('tmin')], 0) + '°F below zero' : D(cold[i][ci('tmin')], 0) + '°F') : '']), ['Hottest year', 'High', 'Coldest year', 'Low']);
      const Mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      barChart($('#d11Mon', root), { cats: Mn, series: [{ name: 'Cooling degree days', color: cssv('--heat'), values: CL.normals.cdd }, { name: 'Heating degree days', color: cssv('--cool'), values: CL.normals.hdd }], H: 240, aria: 'monthly degree day normals' });
      $('#d11Mon', root).insertAdjacentHTML('beforeend', legendRow([{ name: 'Cooling degree days', color: cssv('--heat'), sq: 1 }, { name: 'Heating degree days', color: cssv('--cool'), sq: 1 }]));
      const top = FIPS.slice().sort((a, b) => sum(U1(b)) - sum(U1(a))); const main = top.slice(0, 5), rest = top.slice(5); const colors = CAT();
      const catsY = []; for (let y = BY[0]; y <= 2040; y++) catsY.push(y);
      const ser = main.map((f, i) => ({ name: CNAME(f), color: colors[i], values: catsY.map(y => { const j = BY.indexOf(y); return j >= 0 ? U1(f)[j] : null; }) })).concat([{ name: 'Other 7 counties', color: cssv('--ink-3'), values: catsY.map(y => { const j = BY.indexOf(y); return j >= 0 ? sum(rest.map(f => U1(f)[j] || 0)) : null; }) }]);
      barChart($('#d11Bps', root), { cats: catsY.map(String), series: ser, stacked: true, maxLabels: 12, H: 280, aria: 'single family permits by county', tipExtra: i => { const y = catsY[i]; const j = BY.indexOf(y - 15); return j >= 0 ? tipRow('Homes turning 15 this year', N(sum(FIPS.map(f => U1(f)[j] || 0)))) : ''; } });
      const svgB = $('#d11Bps svg', root); if (svgB) { const vb = svgB.viewBox.baseVal; const Wd = vb.width, Hh = vb.height, L0 = 58, R0 = 16, T = 16, B = 40; const n = catsY.length, bw = (Wd - L0 - R0) / n; const tot = catsY.map((y, i) => sum(ser.map(s => s.values[i] || 0))); const echo = catsY.map(y => { const j = BY.indexOf(y - 15); return j >= 0 ? sum(FIPS.map(f => U1(f)[j] || 0)) : null; }); const mx = Math.max(...tot, ...echo.filter(isN)); const yt = niceTicks(0, mx, 5); const y1 = yt[yt.length - 1];
        const X = i => L0 + bw * i + bw / 2, Y = v => Hh - B - (Hh - B - T) * v / y1; const d = echo.map((v, i) => isN(v) ? [X(i), Y(v)] : null).filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
        svgB.appendChild(svgEl('path', { d, fill: 'none', stroke: cssv('--ink'), 'stroke-width': 2.2, 'stroke-dasharray': '6 4' })); }
      $('#d11BpsL', root).innerHTML = legendRow(ser.map(s => ({ name: s.name, color: s.color, sq: 1 })).concat([{ name: 'Homes turning 15 (permits lagged 15 years)', color: cssv('--ink'), dash: 1 }]));
      const hy = HY.map(r => r[0]); const hi = k => HC.indexOf(k);
      barChart($('#d11Hail', root), { cats: hy.map(String), series: [{ name: 'Under 1 inch', color: ramp('blue')[2], values: HY.map(r => r[hi('n')] - r[hi('n1')]) }, { name: '1 to 1.75 inches', color: ramp('blue')[4], values: HY.map(r => r[hi('n1')] - r[hi('n175')]) }, { name: '1.75 to 2.75 inches', color: ramp('blue')[6], values: HY.map(r => r[hi('n175')] - r[hi('n275')]) }, { name: '2.75 inches or more', color: cssv('--heat'), values: HY.map(r => r[hi('n275')]) }], stacked: true, maxLabels: 11, H: 260, aria: 'hail reports by year and size', tipExtra: i => tipRow('Largest stone', D(HY[i][hi('max')], 2) + ' in') });
      $('#d11HailL', root).innerHTML = legendRow([{ name: 'Under 1 inch', color: ramp('blue')[2], sq: 1 }, { name: '1 to 1.75 inches', color: ramp('blue')[4], sq: 1 }, { name: '1.75 to 2.75', color: ramp('blue')[6], sq: 1 }, { name: '2.75 or more', color: cssv('--heat'), sq: 1 }]);
      const YBL = ['2020 or later', '2010s', '2000s', '1990s', '1980s', '1970s', '1960s', '1950s', '1940s', 'Before 1940'];
      $('#d11Cmp', root).innerHTML = proseTable([
        ['Median year built', `<b>${META.medyr_msa}</b>`, META.medyr_tx, META.medyr_us], ['Built 2010 or later', `<b>${P(META.yb_msa[0] + META.yb_msa[1], 1)}</b>`, P(META.yb_tx[0] + META.yb_tx[1], 1), P(META.yb_us[0] + META.yb_us[1], 1)], ['Built in the 2000s', `<b>${P(META.yb_msa[2], 1)}</b>`, P(META.yb_tx[2], 1), P(META.yb_us[2], 1)], ['Built 1980 to 1999', `<b>${P(META.yb_msa[3] + META.yb_msa[4], 1)}</b>`, P(META.yb_tx[3] + META.yb_tx[4], 1), P(META.yb_us[3] + META.yb_us[4], 1)], ['Built before 1980', `<b>${P(sum(META.yb_msa.slice(5)), 1)}</b>`, P(sum(META.yb_tx.slice(5)), 1), P(sum(META.yb_us.slice(5)), 1)],
        ['Gas heat', `<b>${P(META.gas_msa, 1)}</b>`, P(META.gas_tx, 1), P(META.gas_us, 1)], ['Electric heat', `<b>${P(META.elec_msa, 1)}</b>`, P(META.elec_tx, 1), P(META.elec_us, 1)], ['Owner occupied', `<b>${P(META.own_msa, 1)}</b>`, P(META.own_tx, 1), P(META.own_us, 1)], ['Single family detached', `<b>${P(META.sf_msa, 1)}</b>`, P(META.sf_tx, 1), P(META.sf_us, 1)], ['Median home value', `<b>${M$(META.value_msa)}</b>`, M$(META.value_tx), M$(META.value_us)], ['Median household income', `<b>${M$(META.inc_msa)}</b>`, M$(META.inc_tx), M$(META.inc_us)]], ['Measure', 'DFW metro', 'Texas', 'United States']) + `<p class="chartnote">Metro is the Dallas Fort Worth Arlington MSA as published; the atlas's 12 counties differ slightly. ${G('A')} ${esc(YBL[0])} is the newest band.</p>`;
      $('#d11Big', root).innerHTML = proseTable((DATA.hail.big || []).slice(0, 14).map(r => [new Date(r[0] + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), esc(String(r[1]).toLowerCase().replace(/\b[a-z]/g, m => m.toUpperCase())), esc(r[2]), `<b>${D(r[3], 2)} in</b>`]), ['Date', 'Place', 'County', 'Size']);
    }
    function renderTables() {
      const host = $('#d11Cty', root);
      dataTable(host, [{ k: 'name', h: 'County', l: 1 }, { k: 'pop', h: 'Residents', f: N }, { k: 'occ', h: 'Homes', f: N }, { k: 'sys', h: 'Systems', f: N }, { k: 'ge', h: '15 or older', v: k => 100 * k.ge15 / k.sys, f: v => P(v, 0) }, { k: 'r22', h: 'R22 era', f: N }, { k: 'rep', h: 'Replacements a year', f: N }, { k: 'furn20', h: 'Furnaces 20+', f: N }, { k: 'gas_sh', h: 'Gas heat', f: v => P(v, 0) }, { k: 'medyr', h: 'Median built', f: v => Math.round(v) }, { k: 'value', h: 'Median value', f: M$ }, { k: 'inc', h: 'Median income', f: M$ }, { k: 'bps_u1_2015_25', h: 'New homes 2015 to 2025', f: N }, { k: 'hail1_2016', h: 'Hail 1 in+ since 2016', f: N }, { k: 'lic_con', h: 'Contractors', f: N }, { k: 'lic_tech', h: 'Technicians', f: N }, { k: 'sys_per_tech', h: 'Systems per tech', f: N }],
        CO, { sortKey: 'sys', id: k => k.fips, onClick: f => { st.mode = 'county'; $$('#d11Mode button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === 'county'))); st.sel = 'c:' + f; renderMap(); renderLedger(); $('#d11Map', root).scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
      const R = DATA.recs; const svy = CO.map(k => [k.name + ' County', 'Median year built', Math.round(k.medyr), k.moe_medyr, k.moe_medyr / 1.645, null]).concat(CO.map(k => [k.name + ' County', 'Median home value', k.value, k.moe_value, k.moe_value / 1.645, 100 * k.moe_value / 1.645 / k.value])).concat(CO.map(k => [k.name + ' County', 'Median household income', k.inc, k.moe_inc, k.moe_inc / 1.645, 100 * k.moe_inc / 1.645 / k.inc]));
      const recsRows = [['Texas, RECS 2020', 'Central AC mean life, years', R.AC_TX.mean, 1.645 * R.AC_TX.se_mean, R.AC_TX.se_mean, 100 * R.AC_TX.se_mean / R.AC_TX.mean, R.AC_TX.n], ['Texas, RECS 2020', 'Gas furnace mean life, years', R.GasFurn_TX.mean, 1.645 * R.GasFurn_TX.se_mean, R.GasFurn_TX.se_mean, 100 * R.GasFurn_TX.se_mean / R.GasFurn_TX.mean, R.GasFurn_TX.n], ['Texas, RECS 2020', 'Heat pump mean life, years', R.HP_TX.mean, 1.645 * R.HP_TX.se_mean, R.HP_TX.se_mean, 100 * R.HP_TX.se_mean / R.HP_TX.mean, R.HP_TX.n], ['Texas, RECS 2020', 'Central AC Weibull shape k', R.AC_TX.k, 1.645 * R.AC_TX.se_k, R.AC_TX.se_k, 100 * R.AC_TX.se_k / R.AC_TX.k, R.AC_TX.n], ['DFW permits', 'Permit capture ratio, Dallas, Fort Worth, Irving', 100 * (META.cal.Dallas.obs + META.cal['Fort Worth'].obs + META.cal.Irving.obs) / (META.cal.Dallas.model + META.cal['Fort Worth'].model + META.cal.Irving.model), null, null, null, META.cal.Dallas.nzip + META.cal['Fort Worth'].nzip + META.cal.Irving.nzip], ['DFW permits', 'Capture elasticity to income', META.cap_elast.b, 1.645 * META.cap_elast.se, META.cap_elast.se, 100 * META.cap_elast.se / META.cap_elast.b, null]];
      $('#d11Svy', root).innerHTML = `<table class="prose"><thead><tr><th>Area</th><th>Measure</th><th>Estimate</th><th>± 90%</th><th>SE</th><th>CV</th><th>n</th></tr></thead><tbody>${recsRows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td><b>${D(r[2], /ratio/.test(r[1]) ? 1 : 2)}${/ratio/.test(r[1]) ? '%' : ''}</b></td><td>${isN(r[3]) ? D(r[3], 2) : '—'}</td><td>${isN(r[4]) ? D(r[4], 3) : '—'}</td><td>${isN(r[5]) ? D(r[5], 1) + '%' : '—'}</td><td>${isN(r[6]) ? N(r[6]) : '—'}</td></tr>`).join('')}${svy.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td><b>${/value|income/.test(r[1]) ? M$(r[2]) : r[2]}</b></td><td>${/value|income/.test(r[1]) ? M$(r[3]) : D(r[3], 0)}</td><td>${/value|income/.test(r[1]) ? M$(r[4]) : D(r[4], 1)}</td><td>${isN(r[5]) ? D(r[5], 1) + '%' : '—'}</td><td>ACS</td></tr>`).join('')}</tbody></table>`;
      st.svy = recsRows.concat(svy.map(r => r.concat(['ACS'])));
      const NT = (DATA.hm && DATA.hm.nt) || []; $('#d11Nt', root).innerHTML = proseTable(NT.map(r => [esc(r[0]), `<b>${esc(r[1])}</b>`, r[3] ? `<a href="${esc(r[3])}" target="_blank" rel="noopener">${esc(r[2])}</a>` : esc(r[2]), G(r[4] || 'B')]), ['Constant', 'Value', 'Source', 'Grade']);
      const CP = (DATA.hm && DATA.hm.components) || []; $('#d11Comp', root).innerHTML = proseTable(CP.map(r => [/^\s/.test(r[0]) ? '&nbsp;&nbsp;' + esc(r[0].trim()) : `<b>${esc(r[0])}</b>`, r[1] ? `<b>${esc(r[1])}</b>` : '', esc(r[2] || ''), G(String(r[5] || 'C').replace(/[^A-D\/]/g, '').split('/')[0] || 'C')]), ['Component', 'Share', 'Note', 'Grade']);
      const ZE = DATA.zone_events || {}; const types = Object.keys(ZE); const yrs = [...new Set(types.flatMap(t => Object.keys(ZE[t])))].sort();
      $('#d11Zone', root).innerHTML = `<table class="prose"><thead><tr><th>Year</th>${types.map(t => `<th>${esc(t)}</th>`).join('')}</tr></thead><tbody>${yrs.slice().reverse().map(y => `<tr><td>${y}</td>${types.map(t => `<td>${ZE[t][y] || ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      renderHeadlines(); renderInv();
    }
    function renderHeadlines() { const k = st.area === 'dfw' ? null : COI[st.area]; $('#d11Hls', root).innerHTML = proseTable(headline(null, k).map(r => [esc(r[0]), `<b>${r[4](r[1])}</b>`, esc(r[2]), G(r[3])]), ['Figure', k ? k.name + ' County' : 'Dallas Fort Worth', 'Source', 'Grade']); }
    $('#d11Area', root).onchange = e => { st.area = e.target.value; renderHeadlines(); };
    function renderInv() { const doms = [...new Set(DFW_INV.map(r => r[1].split(' · ')[0]))], accs = [...new Set(DFW_INV.map(r => r[5]))];
      const sd = $('#d11Dom', root), sa = $('#d11Acc', root); if (sd.options.length === 1) { sd.insertAdjacentHTML('beforeend', doms.map(d => `<option>${esc(d)}</option>`).join('')); sa.insertAdjacentHTML('beforeend', accs.map(d => `<option>${esc(d)}</option>`).join('')); }
      const rows = DFW_INV.filter(r => (!st.dom || r[1].startsWith(st.dom)) && (!st.acc || r[5] === st.acc));
      $('#d11Inv', root).innerHTML = `<table class="prose"><thead><tr><th>ID</th><th>Domain</th><th>Source and custodian</th><th>What it contains</th><th>Geography and years</th><th>Access</th><th>In this atlas</th></tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td>${i === 0 ? '<b>' + esc(c) + '</b>' : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`; }
    $('#d11Dom', root).onchange = e => { st.dom = e.target.value; renderInv(); }; $('#d11Acc', root).onchange = e => { st.acc = e.target.value; renderInv(); };

    /* ---------- exports ---------- */
    $('#d11CoX', root).onclick = () => saveFile('dfw-counties.csv', toCSV(['fips', 'county', 'residents', 'homes', 'systems', 'ge15', 'ge20', 'r22', 'orig_win', 'replacements_yr', 'furnaces', 'furnaces_20', 'gas_sh', 'median_year_built', 'moe_year_built', 'median_value', 'moe_value', 'median_income', 'moe_income', 'new_sf_2015_2025', 'hail1_since_2016', 'hail175_since_2016', 'contractors', 'technicians', 'systems_per_tech'], CO.map(k => [k.fips, k.name, k.pop, k.occ, Math.round(k.sys), Math.round(k.ge15), Math.round(k.ge20), Math.round(k.r22), Math.round(k.orig_win), Math.round(k.rep), Math.round(k.furn), Math.round(k.furn20), k.gas_sh, k.medyr, k.moe_medyr, k.value, k.moe_value, k.inc, k.moe_inc, k.bps_u1_2015_25, k.hail1_2016, k.hail175_2016, k.lic_con, k.lic_tech, Math.round(k.sys_per_tech)]), 'DFW Thermal Debt Atlas, module 11. Systems, ages and replacements are model estimates (grade C); ACS figures are 2020 to 2024 five year estimates with 90% margins of error.'));
    $('#d11ZiX', root).onclick = () => saveFile('dfw-zips.csv', toCSV(['zip', 'city', 'county', 'occupied', 'systems', 'ge15_sh', 'r22_sh', 'origwin_sh', 'rep_per1k', 'furn20_sh', 'hp_sh', 'gas_sh', 'median_year_built', 'moe_year_built', 'median_value', 'median_income', 'hail1_8km', 'index', 'tier'], Z.map(z => [z.zip, z.city, z.cty, Math.round(z.occ), Math.round(z.sys || 0), z.ge15_sh, z.r22_sh, z.origwin_sh, z.rep_per1k, z.furn20_sh, z.hp_sh, z.gas_sh, z.medyr, z.moe_medyr, z.value, z.inc, z.hail1_8km, z.idx, z.tier]), 'DFW Thermal Debt Atlas, module 11. ZIPs with fewer than 200 occupied homes are not scored.'));
    $('#d11HlX', root).onclick = () => { const rows = [null].concat(CO).flatMap(k => headline(null, k).map(r => [k ? k.name + ' County' : 'Dallas Fort Worth', r[0], r[1], r[2], r[3]])); saveFile('dfw-headlines.csv', toCSV(['area', 'figure', 'value', 'source', 'grade'], rows)); };
    $('#d11InvX', root).onclick = () => saveFile('dfw-data-inventory.csv', toCSV(['id', 'domain', 'source', 'contents', 'geography_years', 'access', 'in_this_atlas'], DFW_INV));
    $('#d11SvyX', root).onclick = () => saveFile('dfw-survey-estimates.csv', toCSV(['area', 'measure', 'estimate', 'moe90', 'se', 'cv_pct', 'n_or_source'], (st.svy || []).map(r => r.slice(0, 7))));
    $('#d11Desk', root).onclick = () => goModule('desk', { zips: topZ() }); $('#d11Forge', root).onclick = () => goModule('forge', { zips: topZ() });
    function topZ() { const f = st.sel && st.sel.startsWith('c:') ? st.sel.slice(2) : st.area !== 'dfw' ? st.area : null; return ZR.filter(z => !f || z.fips === f).sort((a, b) => (b.idx || 0) - (a.idx || 0)).slice(0, 30).map(z => z.zip); }
    renderMap(); renderLedger(); renderCharts(); renderTables();
    BUS.on('theme', () => { renderMap(); renderCharts(); });
  }
});
