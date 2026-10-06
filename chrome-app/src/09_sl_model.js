/* ==== sl_model ==== */
"use strict";
/* ============================ SERVICE LINE CAMPAIGN MODEL ============================ */
/* Fourteen HVAC service lines resolved to every residential ZIP: the addressable pool, the jobs a year, the ticket, the gross
   profit pool, the month by month season, the channel fit, the competitor paid pressure, a priority percentile and a starting
   bid modifier. Also the audience levers each ZIP carries (Spanish build, payment led, cash buyer, senior, new owner, landlord,
   multi system, permit gap) and the weather climatology that times the flights. Used by modules 12 and 13, the shared layer
   catalog in modules 01 and 05, and the Campaign Desk's pacing. Every stated rate is editable and persisted in this browser. */
const SLM = (() => {
  /* ---------- climatology from the monthly weather file (1996 to 2025, 30 seasons) ---------- */
  const WX = DATA.ts.wx_monthly, YR0 = 1996, YR1 = 2025;
  const byMo = Array.from({ length: 12 }, () => []);
  WX.m.forEach((m, i) => { const y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1; if (y >= YR0 && y <= YR1) byMo[mo].push(i); });
  const stat = (key, fn) => byMo.map(ii => ii.length ? fn(ii.map(i => WX[key][i])) : null);
  const pAny = a => 100 * a.filter(v => v >= 1).length / a.length, avg = a => sum(a) / a.length;
  const CLIM = { years: YR1 - YR0 + 1, p100: stat('d100', pAny), m100: stat('d100', avg), p95: stat('d95', pAny), m95: stat('d95', avg), pfr20: stat('fr20', pAny), pfr25: stat('fr25', pAny), tmax: stat('tmax', avg), tmin: stat('tmin', avg), first100: stat('first100', a => sum(a)) };
  const NORM = DATA.climate.normals;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* ---------- seasons: twelve month indices, mean 100 ---------- */
  const norm100 = a => { const s = sum(a) / 12 || 1; return a.map(v => +(v / s * 100).toFixed(1)); };
  const mx = a => Math.max(...a);
  const PERMIT = (() => { const cs = ['Fort Worth', 'Dallas', 'Irving'].map(c => ({ s: DATA.ts[c].season, n: DATA.ts[c].series.length })); const w = sum(cs.map(c => c.n)); return norm100(Array.from({ length: 12 }, (_, m) => sum(cs.map(c => c.s[m] * c.n)) / w)); })();
  const REPAIR = norm100(NORM.cdd.map((c, i) => 0.32 + 0.68 * c / mx(NORM.cdd) + 0.22 * NORM.d100[i] / mx(NORM.d100)));
  const HEAT = norm100(NORM.hdd.map((h, i) => 0.10 + 0.90 * h / mx(NORM.hdd) + 0.15 * (CLIM.pfr20[i] || 0) / 100));
  const FURNACE = norm100(NORM.hdd.map((h, i) => 0.35 + 0.65 * h / mx(NORM.hdd) + (i === 9 || i === 10 ? 0.28 : 0)));
  const HAIL_PRIOR = [1, 2, 10, 28, 30, 16, 4, 3, 3, 2, 1, 0.5]; const HAIL_OBS = Array(12).fill(0); (DATA.hail.big || []).forEach(e => HAIL_OBS[+e[0].slice(5, 7) - 1]++);
  const HAIL = norm100(HAIL_PRIOR.map((p, i) => 0.6 * p / sum(HAIL_PRIOR) + 0.4 * HAIL_OBS[i] / Math.max(1, sum(HAIL_OBS))));
  const MAINT = norm100([95, 105, 135, 150, 125, 80, 60, 65, 110, 135, 110, 70]);
  const POLLEN = [110, 120, 150, 140, 90, 70, 60, 80, 130, 140, 90, 110], OZONE = [0, 0, 0, 10, 30, 40, 40, 40, 30, 10, 0, 0];
  const IAQ = norm100(POLLEN.map((p, i) => p + OZONE[i]));
  const DUCT = norm100([70, 80, 120, 135, 120, 95, 85, 90, 120, 130, 90, 65]);
  const FLAT = Array(12).fill(100);
  const blend = (a, b, wa) => norm100(a.map((v, i) => v * wa + b[i] * (1 - wa)));
  const SEASONS = { permit: PERMIT, repair: REPAIR, heat: HEAT, furnace: FURNACE, hail: HAIL, maint: MAINT, iaq: IAQ, duct: DUCT, flat: FLAT };
  /* ---------- default assumptions (editable, grade D unless noted) ---------- */
  const DEF = {
    cpc: 9.68, budget: 25000, alpha: 0.7,
    rates: { heatRatio: 0.38, r22Hazard: 0.14, ductRate: 0.035, ductAttach: 0.25, maintTake: 0.18, iaqRate: 0.03, iaqAttach: 0.15, ductlessOld: 0.02, ductlessAdd: 0.004, hailRate: 0.004, bizPerCap: 0.0236, bizJobs: 0.35, landlordRate: 0.32 },
    lines: {
      repair: { ticket: 480, margin: 62, pipe: 18, cpcMult: 1.35, cvr: 9.0, close: 70, lsaCpl: 60, metaCpl: 45 },
      replace: { ticket: null, margin: 42, pipe: 0, cpcMult: 1.25, cvr: 5.5, close: 32, lsaCpl: 95, metaCpl: 55 },
      firstwave: { ticket: null, margin: 42, pipe: 0, cpcMult: 1.10, cvr: 4.5, close: 30, lsaCpl: 95, metaCpl: 45 },
      r22: { ticket: null, margin: 42, pipe: 0, cpcMult: 0.85, cvr: 5.0, close: 35, lsaCpl: 90, metaCpl: 50 },
      heat: { ticket: 420, margin: 60, pipe: 15, cpcMult: 1.00, cvr: 8.5, close: 68, lsaCpl: 55, metaCpl: 50 },
      furnace: { ticket: 5600, margin: 45, pipe: 20, cpcMult: 1.00, cvr: 5.5, close: 38, lsaCpl: 85, metaCpl: 60 },
      heatpump: { ticket: null, margin: 42, pipe: 0, cpcMult: 1.05, cvr: 5.0, close: 32, lsaCpl: 90, metaCpl: 60 },
      duct: { ticket: 5500, margin: 48, pipe: 10, cpcMult: 0.75, cvr: 4.0, close: 35, lsaCpl: 70, metaCpl: 50 },
      maint: { ticket: 228, margin: 35, pipe: 12, cpcMult: 0.60, cvr: 6.0, close: 60, lsaCpl: 40, metaCpl: 22 },
      iaq: { ticket: 1350, margin: 58, pipe: 5, cpcMult: 0.55, cvr: 3.0, close: 30, lsaCpl: null, metaCpl: 35 },
      ductless: { ticket: 6500, margin: 45, pipe: 0, cpcMult: 0.90, cvr: 4.0, close: 30, lsaCpl: null, metaCpl: 50 },
      hail: { ticket: null, margin: 40, pipe: 0, cpcMult: 0.70, cvr: 5.0, close: 40, lsaCpl: null, metaCpl: 28 },
      commercial: { ticket: 4200, margin: 38, pipe: 0, cpcMult: 1.15, cvr: 3.0, close: 28, lsaCpl: null, metaCpl: 120 },
      landlord: { ticket: 1100, margin: 50, pipe: 8, cpcMult: 0.80, cvr: 3.5, close: 45, lsaCpl: null, metaCpl: 90 },
    }
  };
  let A = (() => { const s = store.get('tda.sl.v1', null); const a = JSON.parse(JSON.stringify(DEF)); if (s && typeof s === 'object') { if (isN(s.cpc)) a.cpc = s.cpc; if (isN(s.budget)) a.budget = s.budget; if (isN(s.alpha)) a.alpha = s.alpha; Object.assign(a.rates, s.rates || {}); Object.keys(a.lines).forEach(k => Object.assign(a.lines[k], (s.lines || {})[k] || {})); } return a; })();
  const save = () => store.set('tda.sl.v1', A);
  const TICK_MED = DATA.tickets.median || 12599;
  const tadj = z => clamp((z.ticket || TICK_MED) / TICK_MED, 0.75, 1.55);
  /* ---------- platform lead cost models used for the blended cost per lead ---------- */
  const PLAT_FIT_KEYS = ['google', 'lsa', 'meta', 'dg', 'microsoft', 'nextdoor', 'yelp', 'linkedin'];
  const PLAT_LABEL = { google: 'Google Search', lsa: 'Local Services Ads', meta: 'Meta', dg: 'YouTube and Demand Gen', microsoft: 'Microsoft', nextdoor: 'Nextdoor', yelp: 'Yelp', linkedin: 'LinkedIn' };
  /* ---------- daypart templates: 7 days x 6 blocks, bid adjustment in % (grade C, replace with account hour of day reports) ---------- */
  const BLOCKS = ['12a to 6a', '6a to 9a', '9a to 12p', '12p to 5p', '5p to 9p', '9p to 12a'];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dp = (wk, sat, sun) => [wk, wk, wk, wk, wk, sat, sun];
  const DAYPARTS = {
    emergency: dp([-10, 5, 10, 15, 25, 15], [0, 15, 20, 20, 20, 10], [0, 15, 20, 20, 25, 10]),
    considered: dp([-30, -5, 0, 5, 20, 10], [-25, 5, 15, 15, 10, 0], [-25, 5, 15, 15, 20, 0]),
    daytime: dp([-40, 0, 10, 10, 0, -20], [-40, 0, 5, 0, -10, -30], [-45, -10, -5, -5, -10, -30]),
    business: dp([-50, 10, 25, 25, -10, -40], [-50, -30, -30, -30, -40, -50], [-50, -40, -40, -40, -40, -50]),
  };
  /* ---------- the fourteen lines ---------- */
  const R = () => A.rates;
  const ownSF = z => z.occ * (z.own_sf_sh || 0) / 100, rentSF = z => z.occ * (z.rent_sf_sh || 0) / 100;
  const pre1960 = z => (z.yb ? (z.yb[7] + z.yb[8] + z.yb[9]) : 0) * (z.occ && z.hu ? z.occ / z.hu : 0.9);
  const biz = z => z.pop * R().bizPerCap * clamp(0.7 + 0.6 * (z.density || 0) / 2000, 0.7, 1.6);
  const LINES = [
    { id: 'repair', short: 'AC Repair', name: 'Air conditioning repair', kind: 'base', desk: 'repair', angle: 'repair', season: 'repair', seasonSrc: 'Cooling degree days and 100°F day normals (NWS 1991 to 2020) with the ServiceTitan heat wave surge (+20% calls) on 100°F months', g: 'B', dayparts: 'emergency', mobile: 78, intent: 'Emergency and same week search; calls over forms',
      pool: z => z.sys, poolL: 'central systems', jobs: z => z.repairs, jobsL: 'paid repair calls a year (atlas call rate by system age)', ticketF: z => A.lines.repair.ticket * clamp(0.85 + 0.15 * tadj(z), 0.85, 1.25),
      fit: { google: 3, lsa: 3, meta: 1, dg: 0, microsoft: 2, nextdoor: 1, yelp: 2, linkedin: 0 }, svc: ['AC repair', 'emergency service'],
      hooks: ['Same day when the call comes before noon', 'The price before the work starts', 'Fixed on the first visit from truck stock', 'Warm air, no air, loud unit: name the symptom in the headline', 'License number in every ad (TDLR)', 'Spanish ad sets where Spanish speaking households pass 15%'],
      negs: ['window unit', 'portable', 'car ac', 'diy', 'parts', 'capacitor near me', 'how to', 'youtube'], triggers: ['First 95°F day (median late May): lift search bids 20% for ten days', 'Any 100°F day: lift LSA weekly budget 30% the same week', 'Heat advisory or excessive heat warning: double evening dayparts'] },
    { id: 'replace', short: 'AC Replacement', name: 'Air conditioner and full system replacement', kind: 'base', desk: 'replace', angle: 'replace', season: 'permit', seasonSrc: 'Monthly HVAC mechanical permits, Fort Worth 2012 to 2026, Dallas 2018 to 2020, Irving 2022 to 2025 (weighted by months observed)', g: 'B', dayparts: 'considered', mobile: 55, intent: 'Considered purchase over two to six weeks; quotes, financing and reviews',
      pool: z => z.ge15, poolL: 'systems 15 years or older', jobs: z => z.rep, jobsL: 'system replacements a year (fitted Weibull renewals)', ticketF: z => z.ticket || TICK_MED,
      fit: { google: 3, lsa: 2, meta: 2, dg: 2, microsoft: 2, nextdoor: 2, yelp: 1, linkedin: 0 }, svc: ['AC installation', 'HVAC installation', 'AC replacement', 'HVAC replacement', 'installation'],
      hooks: ['Repair or replace math in writing', 'A2L refrigerant systems, sized by load calculation', 'Own crew installs, permit pulled, serial numbers recorded', 'Financing creative only in a special ad category campaign on Meta', 'Reviews with a dated count', 'Two systems, one visit for larger homes'],
      negs: ['window', 'portable', 'used', 'wholesale', 'parts', 'diy', 'rv'], triggers: ['Permit season rises from March; heavy up from the first 95°F day through August', 'A 100°F month adds about 1.4% to Dallas permits per 100°F day (module 04)', 'September: shift to shoulder season replacement offers, quieter auctions'] },
    { id: 'firstwave', short: 'Builder First', name: 'First replacement of the builder original system', kind: 'lens', of: 'replace', desk: 'replace', angle: 'firstwave', season: 'permit', seasonSrc: 'Follows the permit season', g: 'B', dayparts: 'considered', mobile: 58, intent: 'Subdivision level; the homeowner has never bought a system',
      pool: z => z.orig_win, poolL: 'original builder systems aged 10 to 25', jobs: z => z.first5 / 5, jobsL: 'first replacements a year (five year window over five)', ticketF: z => (z.ticket || TICK_MED) * 1.05,
      fit: { google: 2, lsa: 1, meta: 3, dg: 2, microsoft: 1, nextdoor: 3, yelp: 0, linkedin: 0 }, svc: ['AC installation', 'HVAC installation', 'AC replacement'],
      hooks: ['Still on the builder system: the first replacement', 'Fix the hot upstairs while sizing the new one', 'Neighborhood proof: installs on the same street', 'Meta and Nextdoor by ZIP, then subdivision creative'], negs: ['new construction', 'builder jobs', 'home builder'], triggers: ['Runs with the permit season; strongest in ZIPs built 2000 to 2012'] },
    { id: 'r22', short: 'R22 Changeout', name: 'R22 era system replacement', kind: 'lens', of: 'replace', desk: 'replace', angle: 'r22', season: 'permit', seasonSrc: 'Follows the permit season; the leak that forces the decision comes in the cooling season', g: 'B', dayparts: 'considered', mobile: 62, intent: 'Triggered by a leak or a recharge quote; educational search',
      pool: z => z.r22, poolL: 'R22 era systems still running', jobs: z => z.r22 * R().r22Hazard, jobsL: 'R22 systems expected to fail a year (hazard at 16 to 25 years)', ticketF: z => z.ticket || TICK_MED,
      fit: { google: 2, lsa: 1, meta: 2, dg: 1, microsoft: 2, nextdoor: 1, yelp: 0, linkedin: 0 }, svc: ['AC installation', 'AC replacement', 'HVAC replacement'],
      hooks: ['R22 has not been produced since 2020; a recharge is money into a system with no future', 'Free label check', 'Never say R22 is illegal to run (Satchel rule R22A)'], negs: ['r22 for sale', 'buy r22', 'r22 price per pound'], triggers: ['June to August recharge quotes', 'Winter: educational search and YouTube'] },
    { id: 'heat', short: 'Heating Repair', name: 'Furnace and heat pump heating repair', kind: 'base', desk: 'heat', angle: 'furnace', season: 'heat', seasonSrc: 'Heating degree day normals with the hard freeze probability (20°F or lower) by month, 1996 to 2025', g: 'B', dayparts: 'emergency', mobile: 74, intent: 'No heat calls on cold nights; safety language',
      pool: z => z.sys, poolL: 'central systems (heating side)', jobs: z => z.repairs * R().heatRatio * (0.85 + 0.15 * (z.gas_sh || 0) / 37.3), jobsL: 'heating repair calls a year (ratio to cooling calls, gas weighted)', ticketF: z => A.lines.heat.ticket * clamp(0.85 + 0.15 * tadj(z), 0.85, 1.25),
      fit: { google: 3, lsa: 3, meta: 1, dg: 0, microsoft: 2, nextdoor: 1, yelp: 2, linkedin: 0 }, svc: ['heating', 'furnace repair', 'furnaces'],
      hooks: ['Heat back on today', 'Carbon monoxide test on every visit', 'Igniters, flame sensors, boards priced before the work', 'Heat pump blowing cold: defrost and strip heat explained'], negs: ['space heater', 'water heater', 'fireplace', 'boiler parts'], triggers: ['First forecast freeze (October or November): open the heating campaigns', 'Hard freeze (20°F) months, December to February: emergency dayparts on', 'Winter storm warning: LSA budget uncapped for the week'] },
    { id: 'furnace', short: 'Furnace Replacement', name: 'Gas furnace replacement', kind: 'base', desk: 'heat', angle: 'furnace', season: 'furnace', seasonSrc: 'Heating degree days with an October and November pre season lift (safety checks find the cracked heat exchangers)', g: 'C', dayparts: 'considered', mobile: 56, intent: 'Safety driven decision; often a pre winter inspection finding',
      pool: z => z.furn20, poolL: 'gas furnaces 20 years or older', jobs: z => z.furn_rep, jobsL: 'furnace replacements a year (fitted furnace lifetimes)', ticketF: z => A.lines.furnace.ticket * clamp(0.85 + 0.2 * tadj(z), 0.85, 1.3),
      fit: { google: 3, lsa: 3, meta: 1, dg: 1, microsoft: 2, nextdoor: 1, yelp: 1, linkedin: 0 }, svc: ['furnaces', 'furnace repair', 'furnace installation', 'heating'],
      hooks: ['Is your furnace past 20? Have it checked before the first cold night', 'Heat exchanger inspection with photos', 'Matched furnace and coil when the AC is due too'], negs: ['furnace filter', 'water heater', 'wood furnace', 'outdoor furnace'], triggers: ['October: pre season inspection offer', 'First hard freeze: replacement quotes convert fastest'] },
    { id: 'heatpump', short: 'Heat Pump', name: 'Heat pump replacement', kind: 'lens', of: 'replace', desk: 'replace', angle: 'heatpump', season: 'permit', seasonSrc: 'Permit season blended 70/30 with the heating season (a heat pump fails in both)', g: 'B', dayparts: 'considered', mobile: 58, intent: 'Dual season failure; electric heated homes',
      pool: z => z.sys_hp, poolL: 'heat pumps (model)', jobs: z => z.rep_hp, jobsL: 'heat pump replacements a year', ticketF: z => (z.ticket || TICK_MED) * 1.12,
      fit: { google: 3, lsa: 2, meta: 2, dg: 1, microsoft: 2, nextdoor: 1, yelp: 1, linkedin: 0 }, svc: ['heat pumps'],
      hooks: ['Heating and cooling in one system, worn on both sides', 'Cold air in heat mode: repair or replace, in writing', 'Oncor rebates only with the current program year terms'], negs: ['pool heat pump', 'water heater heat pump', 'geothermal diy'], triggers: ['Both peaks: July to August and December to January'] },
    { id: 'duct', short: 'Ductwork', name: 'Ductwork replacement and sealing', kind: 'base', desk: 'replace', angle: 'duct', season: 'duct', seasonSrc: 'Shoulder months when attic work is possible, plus the share bundled into replacements', g: 'C', dayparts: 'considered', mobile: 52, intent: 'Comfort complaint (hot rooms, dust, bills); often an add on to replacement',
      pool: z => ownSF(z) * (z.yb_duct || 0) / 100, poolL: 'owner occupied single family homes built 1980 to 1999', jobs: z => ownSF(z) * (z.yb_duct || 0) / 100 * R().ductRate + z.rep * R().ductAttach, jobsL: 'duct jobs a year (stand alone rate plus the share attached to replacements)', ticketF: z => A.lines.duct.ticket * clamp(0.85 + 0.2 * tadj(z), 0.85, 1.3),
      fit: { google: 2, lsa: 2, meta: 2, dg: 1, microsoft: 1, nextdoor: 2, yelp: 1, linkedin: 0 }, svc: ['ductwork', 'duct sealing', 'duct repair', 'duct cleaning'],
      hooks: ['Hot rooms start in the attic', 'Duct test with a number, not an opinion', 'Replace and balance with the new system, one crew'], negs: ['duct cleaning coupon', 'dryer vent', 'diy duct tape'], triggers: ['March to May and September to November attic weather'] },
    { id: 'maint', short: 'Maintenance', name: 'Maintenance plans and tune ups', kind: 'base', desk: 'maint', angle: 'maint', season: 'maint', seasonSrc: 'Spring cooling and fall heating tune up calendar (industry pattern, grade C)', g: 'C', dayparts: 'daytime', mobile: 60, intent: 'Low urgency; price led; recurring revenue and the replacement pipeline',
      pool: z => ownSF(z), poolL: 'owner occupied single family homes', jobs: z => ownSF(z) * (R().maintTake + 0.03 * ((z.own_recent_sh || 0) >= 22 ? 1 : 0)), jobsL: 'plan or tune up sales a year (take rate, new owner lift)', ticketF: z => A.lines.maint.ticket,
      fit: { google: 1, lsa: 1, meta: 3, dg: 2, microsoft: 1, nextdoor: 3, yelp: 1, linkedin: 0 }, svc: ['maintenance', 'maintenance plans', 'tune-ups', 'preventive maintenance', 'HVAC maintenance'],
      hooks: ['Beat the first heat wave: priority scheduling', 'Two visits a year and a written record', 'Member pricing on repairs (terms in the agreement)', 'New to the house? Know what you bought'], negs: ['diy', 'checklist', 'filter size', 'how to clean'], triggers: ['March: cooling tune up window opens', 'Late September: heating tune up window', 'Avoid July and August (crews are on repairs)'] },
    { id: 'iaq', short: 'Indoor Air', name: 'Indoor air quality: filtration, purification, humidity', kind: 'base', desk: 'iaq', angle: 'iaq', season: 'iaq', seasonSrc: 'North Texas pollen calendar (cedar December to February, oak March to April, ragweed September to October) plus the ozone season (27.8 unhealthy days a year, ALA)', g: 'C', dayparts: 'considered', mobile: 62, intent: 'Health and comfort; social and video creative; attaches to replacements',
      pool: z => ownSF(z), poolL: 'owner occupied single family homes', jobs: z => ownSF(z) * R().iaqRate + z.rep * R().iaqAttach, jobsL: 'IAQ installs a year (stand alone rate plus attach at replacement)', ticketF: z => A.lines.iaq.ticket * clamp(0.85 + 0.25 * tadj(z), 0.85, 1.35),
      fit: { google: 1, lsa: 0, meta: 3, dg: 2, microsoft: 1, nextdoor: 2, yelp: 0, linkedin: 0 }, svc: ['indoor air quality', 'air purification', 'duct cleaning'],
      hooks: ['Cedar season and oak season creative, dated', 'Media air cleaner, UV, dehumidification: name the device', 'No health claims beyond what the manufacturer substantiates'], negs: ['air purifier amazon', 'portable purifier', 'filter subscription', 'dyson'], triggers: ['December to February cedar', 'March to April oak', 'September to October ragweed', 'Ozone action days May to September'] },
    { id: 'ductless', short: 'Ductless', name: 'Ductless mini split systems', kind: 'base', desk: 'ductless', angle: 'ductless', season: 'permit', seasonSrc: 'Permit season blended with a flat base (additions and garages are built year round)', g: 'C', dayparts: 'considered', mobile: 55, intent: 'Room by room problems: additions, garages, homes without ducts',
      pool: z => pre1960(z) + ownSF(z) * ((z.br4p_sh || 0) / 100) * 0.5, poolL: 'homes built before 1960 plus half of large owner occupied homes', jobs: z => pre1960(z) * R().ductlessOld + ownSF(z) * R().ductlessAdd, jobsL: 'ductless installs a year (old stock rate plus additions and garages)', ticketF: z => A.lines.ductless.ticket * clamp(0.85 + 0.25 * tadj(z), 0.85, 1.4),
      fit: { google: 2, lsa: 1, meta: 2, dg: 1, microsoft: 1, nextdoor: 2, yelp: 1, linkedin: 0 }, svc: ['ductless mini-splits', 'mini-splits', 'ductless systems'],
      hooks: ['The garage gym, the sunroom, the room the ducts never reached', 'One outdoor unit, several rooms', 'Installed and permitted by a licensed crew'], negs: ['diy mini split', 'mrcool', 'mini split for sale', 'window'], triggers: ['Spring additions season; summer garage heat'] },
    { id: 'hail', short: 'Hail Damage', name: 'Hail damaged condenser inspection and insurance replacement', kind: 'base', desk: 'replace', angle: 'hail', season: 'hail', seasonSrc: 'North Texas hail climatology blended with the 25 largest NOAA reports in the file (2016 to 2026)', g: 'C', dayparts: 'considered', mobile: 70, intent: 'Event driven: the week after the storm, by ZIP, with photos',
      pool: z => z.sys * clamp((z.hail175_8km || 0) / 10, 0, 3), poolL: 'systems weighted by large hail exposure (reports within 8 km a decade)', jobs: z => z.sys * R().hailRate * clamp((z.hail175_8km || 0) / 10, 0, 3), jobsL: 'claim driven condenser replacements a year (expected value; arrives in lumps)', ticketF: z => (z.ticket || TICK_MED) * 0.75,
      fit: { google: 2, lsa: 1, meta: 3, dg: 1, microsoft: 1, nextdoor: 3, yelp: 0, linkedin: 0 }, svc: ['AC repair', 'AC replacement'],
      hooks: ['Inspection, photos and a written quote; the claim stays between you and your insurer', 'Never offer to waive or pay a deductible (Tex. Ins. Code ch. 707)', 'Geo fenced Meta and Nextdoor inside the storm swath within 72 hours'], negs: ['roof', 'car hail', 'hail repair kit', 'public adjuster'], triggers: ['Any 1.75 inch or larger report inside 8 km: launch within 72 hours', 'April to June is 74% of the season'] },
    { id: 'commercial', short: 'Light Commercial', name: 'Light commercial HVAC (rooftop units, small buildings)', kind: 'base', desk: 'commercial', angle: 'commercial', season: 'permit', seasonSrc: 'Permit season blended 30/70 with flat (facilities budgets are year round)', g: 'D', dayparts: 'business', mobile: 35, intent: 'Facilities managers and owners; business hours; quotes and contracts',
      pool: z => biz(z), poolL: 'businesses (population share proxy; no ZIP business count in the file)', jobs: z => biz(z) * R().bizJobs, jobsL: 'commercial jobs a year (repairs and rooftop replacements per business)', ticketF: z => A.lines.commercial.ticket,
      fit: { google: 3, lsa: 0, meta: 1, dg: 1, microsoft: 2, nextdoor: 0, yelp: 1, linkedin: 2 }, svc: ['commercial HVAC', 'commercial refrigeration', 'new construction HVAC'],
      hooks: ['Rooftop unit replacement quoted by tonnage', 'Preventive maintenance contract for multi tenant buildings', 'Response time in hours, in writing'], negs: ['residential', 'home', 'apartment for rent', 'jobs'], triggers: ['Budget season (Q4) for contracts; summer for failures'] },
    { id: 'landlord', short: 'Rental Homes', name: 'Landlord and property manager service', kind: 'base', desk: 'b2b', angle: 'landlord', season: 'repair', seasonSrc: 'Follows the repair season (tenant calls) blended 60/40 with flat', g: 'C', dayparts: 'business', mobile: 45, intent: 'Portfolio buyers: one invoice, many homes; B2B channels',
      pool: z => rentSF(z), poolL: 'single family homes that are rented', jobs: z => rentSF(z) * R().landlordRate, jobsL: 'rental home jobs a year (repairs plus one replacement in fifteen)', ticketF: z => A.lines.landlord.ticket,
      fit: { google: 2, lsa: 0, meta: 1, dg: 0, microsoft: 1, nextdoor: 0, yelp: 0, linkedin: 3 }, svc: ['AC repair', 'AC installation'],
      hooks: ['Fast tenant response, one clear invoice', 'Portfolio pricing on replacements', 'Straight advice on which units to replace before summer'], negs: ['tenant rights', 'who pays', 'apartment', 'landlord insurance'], triggers: ['March to May: pre summer portfolio inspections', 'Institutional owners budget in Q4'] },
  ];
  const LI = {}; LINES.forEach(l => LI[l.id] = l);
  const seasonOf = l => l.id === 'heatpump' ? blend(PERMIT, HEAT, 0.7) : l.id === 'ductless' ? blend(PERMIT, FLAT, 0.5) : l.id === 'commercial' ? blend(PERMIT, FLAT, 0.3) : l.id === 'landlord' ? blend(REPAIR, FLAT, 0.6) : SEASONS[l.season];
  LINES.forEach(l => l.months = seasonOf(l));
  const BASE = LINES.filter(l => l.kind === 'base');
  /* ---------- competitor geometry and paid pressure ---------- */
  const km = (a, b, c, d) => { const R = 6371, dLat = (c - a) * Math.PI / 180, dLon = (d - b) * Math.PI / 180, x = Math.sin(dLat / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  const CK = l => l.domain || l.name;                                   // company key
  const COMPS = COMP.map((l, i) => ({ l, i, key: CK(l), svc: new Set((l.services || []).map(s => s.toLowerCase())) }));
  const adSignal = l => !!(l.intel && l.intel.ad_signals && !/^(none|minimal|-|single line|single number|one number)/i.test(l.intel.ad_signals));
  const NEAR = {}; ZR.forEach(z => { NEAR[z.zip] = COMPS.map(c => ({ c, d: isN(c.l.lat) && isN(z.lat) ? km(z.lat, z.lon, c.l.lat, c.l.lon) : 99 })).filter(x => x.d <= 20 && x.c.l.tier !== 'bench'); });
  let activity = () => ({});                                             // company key -> { [lineId]: n active observed ads } (set by the watch)
  function pressureRaw(z, line) {
    const act = activity(); let p = 0;
    (NEAR[z.zip] || []).forEach(({ c, d }) => {
      const w = Math.exp(-d / 8); const l = c.l;
      let adv = ((l.paid_kw || 0) > 0 ? 1 : 0) + (adSignal(l) ? 0.5 : 0) + (l.tier === 'top40' ? 0.3 : 0.1) + Math.log10((l.reviews || 0) + 1) / 4;
      const a = act[c.key]; if (a) { adv += Math.min(2, 0.6 * ((a[line.id] || 0) + 0.3 * (a._all || 0))); }
      const svc = line.svc.some(s => c.svc.has(s.toLowerCase())) ? 1 : 0.35;
      p += w * adv * svc;
    });
    return p;
  }
  /* ---------- per ZIP, per line computation ---------- */
  const SLZ = {}; const AGG = {}; const PCT = {};
  function compute() {
    LINES.forEach(line => {
      const rows = ZR.map(z => { const pool = Math.max(0, line.pool(z) || 0), jobs = Math.max(0, line.jobs(z) || 0), ticket = line.ticketF(z), Ln = A.lines[line.id]; const rev = jobs * ticket, gpDirect = rev * Ln.margin / 100, gpPipe = jobs * (Ln.pipe || 0) / 100 * (z.ticket || TICK_MED) * A.lines.replace.margin / 100, gp = gpDirect + gpPipe; const press = pressureRaw(z, line); return { z, pool, jobs, ticket, rev, gpDirect, gpPipe, gp, press }; });
      const pv = rows.map(r => r.press); rows.forEach(r => r.presspct = pctRank(pv, r.press));
      rows.forEach(r => { r.cost = (r.z.cpc_rel || 1) * A.lines[line.id].cpcMult; r.eff = r.gp / (r.cost * (0.55 + 0.9 * r.presspct / 100)); });
      const ev = rows.map(r => r.eff), gv = rows.map(r => r.gp); rows.forEach(r => { r.pri = r.gp > 0 ? pctRank(ev, r.eff) : 0; r.gppct = pctRank(gv, r.gp); r.bid = r.pri >= 90 ? 45 : r.pri >= 75 ? 30 : r.pri >= 55 ? 15 : r.pri >= 35 ? 0 : r.pri >= 15 ? -20 : -40; r.quiet = r.gp > 0 && r.presspct <= 45 && r.gppct >= 60; });
      rows.forEach(r => { (SLZ[r.z.zip] = SLZ[r.z.zip] || {})[line.id] = r; r.z['sl_pri_' + line.id] = +r.pri.toFixed(1); r.z['sl_jobs_' + line.id] = +r.jobs.toFixed(1); });
      AGG[line.id] = { pool: sum(rows.map(r => r.pool)), jobs: sum(rows.map(r => r.jobs)), rev: sum(rows.map(r => r.rev)), gp: sum(rows.map(r => r.gp)), quiet: rows.filter(r => r.quiet).length, ticket: sum(rows.map(r => r.rev)) / Math.max(1, sum(rows.map(r => r.jobs))), compN: COMPS.filter(c => c.l.tier !== 'bench' && line.svc.some(s => c.svc.has(s.toLowerCase()))).length, compPaid: COMPS.filter(c => c.l.tier !== 'bench' && (c.l.paid_kw || 0) > 0 && line.svc.some(s => c.svc.has(s.toLowerCase()))).length };
    });
    ZR.forEach(z => { const top = BASE.map(l => SLZ[z.zip][l.id]).sort((a, b) => b.gp - a.gp); z.sl_top = top[0] ? LINES.find(l => SLZ[z.zip][l.id] === top[0]).id : null; z.sl_top2 = top[1] ? LINES.find(l => SLZ[z.zip][l.id] === top[1]).id : null; const best = LINES.map(l => SLZ[z.zip][l.id]).sort((a, b) => b.pri - a.pri)[0]; z.sl_best = best ? LINES.find(l => SLZ[z.zip][l.id] === best).id : null; z.sl_quiet = BASE.filter(l => SLZ[z.zip][l.id].quiet).length; });
  }
  /* ---------- audience and creative levers ---------- */
  const LEV = {};
  const LEVER_DEFS = [
    ['fin', 'Payment led', 'Replacement ticket against household income, less the high income share: above 60 means lead with monthly payment creative (special ad category on Meta), below 40 lead with the system.', 'lev_fin'],
    ['cash', 'Cash and premium', 'High income share, half million dollar homes and owners 65 and over: variable speed, quiet, humidity and warranty creative; fewer financing words.', 'lev_cash'],
    ['es', 'Spanish build', 'Suggested Spanish share of the ZIP budget from limited English Spanish speaking households (1.5x) plus a quarter of all Spanish speaking households.', 'lev_es'],
    ['senior', 'Senior households', 'Owners 65 and over as a share of owners: phone call assets, daytime dayparts, maintenance plans, heat safety and Facebook over short video.', 'own65_sh'],
    ['newowner', 'New owners', 'Owners who moved in 2020 or later: new homeowner system check, no incumbent contractor yet.', 'own_recent_sh'],
    ['landlord', 'Rented single family', 'Single family homes that are rented: B2B property manager campaigns, not consumer creative.', 'rent_sf_sh'],
    ['multisys', 'Multi system homes', 'Four or more bedrooms: two systems per house, zoning and larger tickets; sizing by load calculation in the copy.', 'br4p_sh'],
  ];
  function levers() {
    ZR.forEach(z => {
      const ratio = (z.ticket || TICK_MED) / Math.max(30000, z.inc || 80000);
      const fin = clamp(Math.round(50 + 260 * (ratio - 0.165) - 0.35 * ((z.inc150_sh || 0) - 22) + 0.2 * ((z.own_sf_sh || 0) - 45)), 3, 97);
      const cash = clamp(Math.round(1.6 * (z.inc150_sh || 0) + ((z.value || 0) >= 500000 ? 18 : 0) + 0.5 * (z.own65_sh || 0)), 0, 100);
      const es = clamp(Math.round((z.span_lep_sh || 0) * 1.5 + (z.span_sh || 0) * 0.25), 0, 70);
      const L = { fin, cash, es, senior: (z.own65_sh || 0) >= 28, newowner: (z.own_recent_sh || 0) >= 22, landlord: (z.rent_sf_sh || 0) >= 30, multisys: (z.br4p_sh || 0) >= 35 || (z.rooms || 0) >= 6.5, mf: (z.mf_sh || 0) >= 45, heatvuln: (z.own65_sh || 0) >= 25 && (z.yb_pre1980 || 0) >= 40, permitgap: isN(z.perm_cap) && (z.perm_model || 0) >= 50 ? (z.perm_cap < 0.15) : null };
      const scores = { fin: (fin - 50) / 20, cash: (cash - 40) / 20, es: (es - 15) / 10, senior: ((z.own65_sh || 0) - 24) / 8, newowner: ((z.own_recent_sh || 0) - 18) / 6, landlord: ((z.rent_sf_sh || 0) - 20) / 10, multisys: ((z.br4p_sh || 0) - 25) / 12 };
      L.dominant = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
      L.tags = [L.es ? 'Spanish build ' + es + '%' : null, fin >= 60 ? 'Payment led' : fin <= 40 ? 'System led' : null, cash >= 60 ? 'Cash and premium' : null, L.senior ? 'Senior households' : null, L.newowner ? 'New owners' : null, L.landlord ? 'Rented single family' : null, L.multisys ? 'Multi system homes' : null, L.mf ? 'Apartment heavy' : null, L.heatvuln ? 'Heat vulnerable' : null, L.permitgap === true ? 'Permit gap' : null].filter(Boolean);
      LEV[z.zip] = L; z.lev_fin = fin; z.lev_cash = cash; z.lev_es = es; z.lev_dom = L.dominant;
    });
  }
  /* ---------- economics ---------- */
  function cplByPlatform(line, cpcRel) {
    const Ln = A.lines[line.id]; const rel = cpcRel || median(ZR.map(z => z.cpc_rel)) || 1.3;
    const search = A.cpc * Ln.cpcMult * rel / (Ln.cvr / 100);
    return { google: search, microsoft: search * 0.67, lsa: Ln.lsaCpl, meta: Ln.metaCpl, dg: Math.max(60, Ln.metaCpl * 1.9), nextdoor: Math.max(45, Ln.metaCpl * 1.6), yelp: search * 0.9, linkedin: line.fit.linkedin ? 75 : null };
  }
  function blended(line, cpcRel) {
    const c = cplByPlatform(line, cpcRel); let w = 0, s = 0; const parts = [];
    PLAT_FIT_KEYS.forEach(p => { const f = line.fit[p] || 0; if (!f || !isN(c[p])) return; const wt = f * f; w += wt; s += wt * c[p]; parts.push({ p, share: wt, cpl: c[p] }); });
    parts.forEach(x => x.share = x.share / (w || 1));
    return { cpl: w ? s / w : null, parts };
  }
  function unitEcon(line, zOrNull) {
    const Ln = A.lines[line.id]; const ticket = zOrNull ? line.ticketF(zOrNull) : (AGG[line.id] ? AGG[line.id].ticket : (Ln.ticket || TICK_MED));
    const b = blended(line, zOrNull ? zOrNull.cpc_rel : null); const gpDirect = ticket * Ln.margin / 100, gpPipe = (Ln.pipe || 0) / 100 * ((zOrNull && zOrNull.ticket) || TICK_MED) * A.lines.replace.margin / 100, gpPerJob = gpDirect + gpPipe; const jobsPerLead = Ln.close / 100;
    const cac = b.cpl != null ? b.cpl / jobsPerLead : null; const beCpl = gpPerJob * jobsPerLead;
    return { ticket, margin: Ln.margin, close: Ln.close, pipe: Ln.pipe || 0, cpl: b.cpl, parts: b.parts, cac, gpPerJob, gpDirect, gpPipe, beCpl, roas: cac ? ticket / cac : null, gpRoas: cac ? gpPerJob / cac : null };
  }
  function allocate(budget, month, scope, lineIds, alpha) {
    const ids = lineIds || BASE.map(l => l.id); const zs = scope || ZR; const set = new Set(zs.map(z => z.zip));
    const rows = ids.map(id => { const line = LI[id]; const gp = sum(ZR.filter(z => set.has(z.zip)).map(z => SLZ[z.zip][id].gp)); const s = month == null ? 100 : line.months[month]; const u = unitEcon(line, null); const lev = u.gpRoas || 0.01; return { line, gp, season: s, u, w: Math.pow(Math.max(1, gp * s / 100 * lev), alpha == null ? A.alpha : alpha) }; });
    const W = sum(rows.map(r => r.w)) || 1;
    rows.forEach(r => { r.budget = budget * r.w / W; r.leads = r.u.cpl ? r.budget / r.u.cpl : 0; r.jobs = r.leads * r.u.close / 100; r.rev = r.jobs * r.u.ticket; r.gpOut = r.jobs * r.u.gpPerJob; r.cap = r.gp * (month == null ? 1 : r.season / 100 / 12); r.share = r.cap > 0 ? r.jobs / Math.max(1e-9, sum(zs.map(z => SLZ[z.zip][r.line.id].jobs)) * (month == null ? 1 : r.season / 100 / 12)) : 0; });
    return rows.sort((a, b) => b.budget - a.budget);
  }
  /* ---------- layer catalog additions for modules 01 and 05 ---------- */
  const layers = () => {
    const out = {
      lev_fin: { l: 'Payment led score (0 to 100)', grp: 'Campaign levers', dir: 1, ramp: 'teal', g: 'C', f: v => D(v, 0), note: 'Replacement ticket against household income, less the high income share. Above 60: lead with monthly payment creative in a Meta special ad category campaign; below 40: lead with the system.' },
      lev_cash: { l: 'Cash and premium score (0 to 100)', grp: 'Campaign levers', dir: 1, ramp: 'teal', g: 'C', f: v => D(v, 0), note: 'High income share, half million dollar homes and owners 65 and over. Variable speed, quiet and warranty creative.' },
      lev_es: { l: 'Suggested Spanish budget share (%)', grp: 'Campaign levers', dir: 1, ramp: 'teal', g: 'B', f: v => P(v, 0), note: 'Limited English Spanish speaking households times 1.5 plus a quarter of all Spanish speaking households (ACS C16002).' },
      sl_quiet: { l: 'Quiet auctions: lines with high profit pool and low paid pressure (count)', grp: 'Campaign levers', dir: 1, ramp: 'ember', g: 'C', f: v => D(v, 0), note: 'Of the eleven base service lines, how many put this ZIP in the top 40% of gross profit pool while competitor paid pressure sits in the bottom 45%.' },
    };
    LINES.forEach(l => { out['sl_pri_' + l.id] = { l: `${l.short}: campaign priority (percentile)`, grp: 'Service line priority', dir: 1, ramp: 'ember', g: l.g === 'D' ? 'D' : 'C', f: v => D(v, 0), note: `${l.name}. Gross profit pool per relative click cost, discounted by competitor paid pressure for this line. Module 12 has the ledger.` }; });
    return out;
  };
  /* ---------- exports ---------- */
  const lineName = id => (LI[id] || {}).short || id;
  function matrixLong(zs) {
    const H = ['zip', 'city', 'county', 'line', 'line_kind', 'pool', 'jobs_per_year', 'ticket_usd', 'revenue_pool_usd', 'gross_profit_pool_usd', 'gp_direct_usd', 'gp_pipeline_usd', 'pressure_pct', 'cost_index', 'priority_pct', 'bid_modifier_pct', 'quiet_auction', 'spanish_share_pct', 'payment_led_score', 'cash_premium_score', 'levers', 'google_criterion_id'];
    const rows = []; (zs || ZR).forEach(z => LINES.forEach(l => { const r = SLZ[z.zip][l.id], L = LEV[z.zip]; rows.push([z.zip, z.city, z.cty, l.id, l.kind, Math.round(r.pool), +r.jobs.toFixed(1), Math.round(r.ticket), Math.round(r.rev), Math.round(r.gp), Math.round(r.gpDirect), Math.round(r.gpPipe), +r.presspct.toFixed(1), +r.cost.toFixed(3), +r.pri.toFixed(1), r.bid, r.quiet ? 1 : 0, L.es, L.fin, L.cash, L.tags.join('; '), z.gid || '']); }));
    return toCSV(H, rows, `DFW Thermal Debt Atlas, module 12. ${LINES.length} service lines x ${(zs || ZR).length} ZIPs. Pools grade A/B, job rates B to D by line, tickets B (permits) or D (stated), pressure C. Assumptions as saved in this browser.`);
  }
  function matrixWide(zs) {
    const H = ['zip', 'city', 'county', 'households', 'top_line_by_profit', 'second_line', 'best_ranked_line', 'quiet_lines', 'spanish_share_pct', 'payment_led', 'cash_premium', 'levers'].concat(LINES.map(l => 'pri_' + l.id));
    return toCSV(H, (zs || ZR).map(z => { const L = LEV[z.zip]; return [z.zip, z.city, z.cty, Math.round(z.occ), lineName(z.sl_top), lineName(z.sl_top2), lineName(z.sl_best), z.sl_quiet, L.es, L.fin, L.cash, L.tags.join('; ')].concat(LINES.map(l => +SLZ[z.zip][l.id].pri.toFixed(0))); }), 'Priority percentiles by service line, one row per ZIP.');
  }
  function googleLocations(lineId, zs, n) { const l = LI[lineId]; const rows = (zs || ZR).map(z => SLZ[z.zip][lineId]).sort((a, b) => b.pri - a.pri).slice(0, n || 60); return toCSV(['Campaign', 'Location', 'ID', 'Bid Modifier', 'Criterion Type', 'Status'], rows.map(r => [`DFW_${l.id.toUpperCase()}_SEARCH`, `${r.z.zip}, Texas, United States`, r.z.gid || '', (r.bid >= 0 ? '+' : '') + r.bid + '%', 'Location', 'Enabled'])); }
  function metaZips(lineId, zs, n) { const l = LI[lineId]; const rows = (zs || ZR).map(z => SLZ[z.zip][lineId]).sort((a, b) => b.pri - a.pri).slice(0, n || 60); return toCSV(['Zip', 'zip', 'city', 'priority_pct', 'spanish_share_pct', 'levers'], rows.map(r => ['US:' + r.z.zip, r.z.zip, r.z.city, r.pri.toFixed(0), LEV[r.z.zip].es, LEV[r.z.zip].tags.join('; ')]), `Meta ad set ZIP list for ${l.name}. Financing creative belongs in a special ad category campaign with a 15 mile radius and no ZIP targeting.`); }
  function calendar(budget, zs) { const H = ['line', 'kind'].concat(MONTHS).concat(['season_source', 'triggers']); const rows = LINES.map(l => [l.short, l.kind].concat(l.months.map(v => v)).concat([l.seasonSrc, l.triggers.join(' | ')])); const alloc = MONTHS.map((_, m) => allocate(budget || A.budget, m, zs, null)); const H2 = ['line'].concat(MONTHS.map(m => m + '_usd')); const rows2 = BASE.map(l => [l.short].concat(alloc.map(a => Math.round((a.find(r => r.line.id === l.id) || {}).budget || 0)))); return toCSV(H, rows, 'Season index by month, mean 100.') + '\n' + toCSV(H2, rows2, `Suggested monthly media by base line at ${M$(budget || A.budget)} a month, concentration ${A.alpha}.`); }
  /* ---------- public ---------- */
  function recompute() { compute(); BUS.emit('sl'); }
  levers(); compute();
  return {
    LINES, LI, BASE, SLZ, AGG, LEV, LEVER_DEFS, CLIM, NORM, MONTHS, SEASONS, DAYPARTS, BLOCKS, DAYS, PLAT_FIT_KEYS, PLAT_LABEL, DEF, HAIL_OBS, HAIL_PRIOR, TICK_MED,
    get A() { return A; }, set(patch) { if (patch.cpc != null) A.cpc = patch.cpc; if (patch.budget != null) A.budget = patch.budget; if (patch.alpha != null) A.alpha = patch.alpha; if (patch.rates) Object.assign(A.rates, patch.rates); if (patch.lines) Object.keys(patch.lines).forEach(k => Object.assign(A.lines[k], patch.lines[k])); save(); recompute(); },
    reset() { A = JSON.parse(JSON.stringify(DEF)); save(); recompute(); },
    setActivity(fn) { activity = fn; recompute(); },
    recompute, cplByPlatform, blended, unitEcon, allocate, layers, matrixLong, matrixWide, googleLocations, metaZips, calendar, lineName,
    seasonFor(deskLine) { const m = { repair: 'repair', replace: 'replace', heat: 'heat', maint: 'maint', b2b: 'landlord', recruit: null, blend: 'replace', iaq: 'iaq', ductless: 'ductless', commercial: 'commercial', landlord: 'landlord' }; const id = m[deskLine]; return id && LI[id] ? LI[id].months : null; },
    compKey: CK, adSignal, NEAR,
  };
})();
