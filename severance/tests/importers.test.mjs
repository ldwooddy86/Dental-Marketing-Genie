/* CSV importers of the accounts core (src/07_accounts_core.js): one small inline fixture per format (Google Ads campaign, hour of day and
   user location reports, Meta Ads Manager, TikTok Ads Manager, Microsoft Advertising, Local Services Ads leads, YouTube Studio, CallRail
   and CallTrackingMetrics call logs, Clio Grow and Lawmatics intake exports, the generic sheet and its template), asserting the normalized
   rows, the service line inferred from practice areas, ad groups and campaigns, ZIP and county from geography, the retained counts, the
   channel each inquiry came from, duplicate imports, and the rates the Campaign Desk reads. Also: storage goes to chrome.storage.local
   under sv.accounts.v1 in the extension, and nothing identifying (names, emails, phone numbers) is stored. `node tests/run.mjs importers` */
import { runFile } from './lib/load.mjs';
import { assert, eq } from './lib/mock.mjs';

const SETS = []; const LOCAL = {};
globalThis.chrome = { runtime: { id: 'test-ext' }, storage: { local: { get: async k => (k in LOCAL ? { [k]: LOCAL[k] } : {}), set: async o => { SETS.push(Object.keys(o)); Object.assign(LOCAL, JSON.parse(JSON.stringify(o))); } } } };
const MEM = {};
globalThis.store = { get: (k, d) => (k in MEM ? JSON.parse(MEM[k]) : d), set: (k, v) => { MEM[k] = JSON.stringify(v); } };
const EMITS = []; globalThis.BUS = { h: {}, on(e, f) { (this.h[e] = this.h[e] || []).push(f); }, emit(e, d) { EMITS.push([e, d]); (this.h[e] || []).forEach(f => f(d)); } };
globalThis.inViewer = () => false; globalThis.registerModule = () => { };
const isN = v => typeof v === 'number' && isFinite(v); const sum = a => a.reduce((x, y) => x + (y || 0), 0);
globalThis.isN = isN; globalThis.sum = sum; globalThis.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const csvQ = v => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };   /* as in src/01_kit.js */
globalThis.toCSV = (h, rows, note) => (note ? note.split('\n').map(l => '# ' + l).join('\n') + '\n' : '') + h.map(csvQ).join(',') + '\n' + rows.map(r => r.map(csvQ).join(',')).join('\n') + '\n';
globalThis.ZC = [{ zip: '77005', county: '48201', county_name: 'Harris', city: 'Houston', gt: '9040005', acs: { pop: 30000 } }, { zip: '77002', county: '48201', county_name: 'Harris', city: 'Houston', gt: '9040002', acs: { pop: 12000 } }, { zip: '75093', county: '48085', county_name: 'Collin', city: 'Plano', gt: '9040093', acs: { pop: 50000 } }, { zip: '78704', county: '48453', county_name: 'Travis', city: 'Austin', gt: '9040704', acs: { pop: 45000 } }];
globalThis.ZI = {}; ZC.forEach(z => { ZI[z.zip] = z; });
globalThis.CTY = [{ fips: '48201', name: 'Harris' }, { fips: '48085', name: 'Collin' }, { fips: '48453', name: 'Travis' }, { fips: '48157', name: 'Fort Bend' }, { fips: '48113', name: 'Dallas' }]; globalThis.CI = {}; CTY.forEach(c => { CI[c.fips] = c; });
runFile('src/25_m06_lines.js');
runFile('src/07_accounts_core.js');
const ACCT = globalThis.ACCT; await ACCT.ready();
eq(ACCT.ENV, 'chrome', 'extension');
const dstr = d => d.toISOString().slice(0, 10); const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const D3 = dstr(ago(3)), D5 = dstr(ago(5)), D8 = dstr(ago(8)), D20 = dstr(ago(20)), D40 = dstr(ago(40)), D2 = dstr(ago(2)), TODAY = dstr(new Date());
const slash = iso => { const [y, m, d] = iso.split('-'); return `${+m}/${+d}/${y}`; };
const pick = (r, ks) => ks.map(k => r[k]);

/* ============================ line inference ============================ */
const LINES = [
  ['Divorce with Children', 'div_k'], ['Family Law - Divorce with Children', 'div_k'], ['Divorce custody lawyer', 'div_k'], ['Uncontested divorce', 'div_nk'], ['Divorce (no children)', 'div_nk'], ['Agreed divorce flat fee', 'div_nk'], ['Divorcio sin hijos', 'div_nk'],
  ['Custody', 'sapcr'], ['SAPCR', 'sapcr'], ['Grandparent rights', 'sapcr'], ['Fathers rights lawyer', 'sapcr'], ['Custodia de menores', 'sapcr'], ['Custody / SAPCR', 'sapcr'],
  ['Modification of child support', 'mod'], ['Custody modification', 'mod'], ['Relocation case', 'mod'], ['Enforcement', 'enf'], ['Back child support lawyer', 'enf'], ['Contempt motion', 'enf'],
  ['Protective Order', 'po'], ['Family violence', 'po'], ['Orden de protección', 'po'], ['Child Support', 'ivd'], ['Paternity', 'ivd'], ['Pensión alimenticia', 'ivd'],
  ['Adoption', 'adopt'], ['Stepparent adoption', 'adopt'], ['CPS Defense', 'cps'], ['DFPS removal hearing', 'cps'], ['Prenuptial Agreement', 'prenup'], ['Postnup', 'prenup'],
  ['High net worth divorce', 'high'], ['Business owner divorce', 'high'], ['Military divorce', 'mil'], ['Fort Cavazos divorce attorney', 'mil'], ['Gray divorce', 'gray'], ['Divorce after 50', 'gray'], ['QDRO lawyer', 'gray'],
  ['Divorcio', 'div_k'], ['Family Law', 'div_k'], ['Divorce lawyer Houston', 'div_k'], ['SEV_HIGH_EXEC', 'high'], ['TX_PO_DISPLAY', 'po'], ['SEV_DIV_NK_EN', 'div_nk'], ['Harris | sapcr', 'sapcr'],
  ['High intent search', ''], ['Brand campaign', ''], ['Houston · Divorce, no kids', 'div_nk'], ['Houston · Support / paternity', 'ivd'],
];
LINES.forEach(([n, k]) => eq(ACCT.lineOf(n), k, 'lineOf ' + n));
eq(ACCT.lineOf('Child custody', 'Divorce lawyer'), 'sapcr', 'ad group before campaign'); eq(ACCT.lineOf('Harris County 25 to 54', 'SEV_PO_META'), 'po', 'falls through to the campaign'); eq(ACCT.lineOf('Divorce', 'SEV_MOD_SEARCH'), 'mod', 'a specific match beats a generic one');
assert(Object.keys(LINE_META).every(k => ACCT.lineOf(LINE_META[k].name) === k && ACCT.lineOf(LINE_META[k].short) === k), 'every LINE_META name and short name maps to its own key');
[['Hired', 'retained'], ['Retainer signed', 'retained'], ['Not Hired', 'lost'], ['Hired another attorney', 'lost'], ['Consultation Scheduled', 'consult'], ['Pending', 'open'], ['Unsigned', 'open'], ['', 'open']].forEach(([s, k]) => eq(ACCT.stageOf(s), k, 'stageOf ' + s));
[['Google Ads', 'google'], ['Google Organic', 'organic'], ['Google Business Profile', 'gbp'], ['Local Services Ads', 'lsa'], ['Facebook Lead Ad', 'meta'], ['Instagram', 'meta'], ['Bing', 'microsoft'], ['Avvo', 'directory'], ['Referral from past client', 'referral'], ['Website', 'direct'], ['', 'unknown'], ['Billboard', 'other']].forEach(([s, k]) => eq(ACCT.chanOf(s), k, 'chanOf ' + s));
eq(ACCT.tparts('2026-09-20 14:05:33'), { date: '2026-09-20', hour: 14 }, 'iso timestamp'); eq(ACCT.tparts('09/22/2026 6:40 PM'), { date: '2026-09-22', hour: 18 }, 'us timestamp'); eq(ACCT.tparts('Sep 20, 2026 12:15 AM'), { date: '2026-09-20', hour: 0 }, 'long timestamp'); eq(ACCT.tparts('2026-09-20'), { date: '2026-09-20', hour: null }, 'date only');
eq(ACCT.geoOf({ zip: '77005, Texas, United States' }), { zip: '77005', county: '48201', city: 'Houston', cname: 'Harris' }, 'geo from a Google location string'); eq(ACCT.geoOf({ county: 'Fort Bend County' }), { county: '48157', cname: 'Fort Bend' }, 'geo from a county name'); eq(ACCT.geoOf({ city: 'Plano, TX' }).county, '48085', 'geo from a city'); eq(ACCT.geoOf({ zip: '10001' }), null, 'a ZIP outside Texas is not kept');

/* ============================ Google Ads ============================ */
const g1 = ACCT.importCSV(`Campaign report\n"Sep 1, 2026 to Sep 30, 2026"\nCampaign,Ad group,Day,Impr.,Clicks,Cost,Conversions,Phone calls\nSEV_DIV_K_HARRIS,Divorce with kids Houston,${D3},1200,40,"1,234.50",3,1\nHarris Custody Search,Grandparent rights,${D5},800,22,310.00,2,0\nTotal: Account,,,2000,62,1544.50,5,1\n`);
eq(g1.importer.id, 'google-ui', 'google campaign report detected'); eq(g1.rows.length, 2, 'preamble and total skipped');
eq(pick(g1.rows[0], ['src', 'kind', 'date', 'hour', 'campaign', 'adset', 'imp', 'clicks', 'spend', 'leads', 'calls', 'line']), ['google', 'ads', D3, null, 'SEV_DIV_K_HARRIS', 'Divorce with kids Houston', 1200, 40, 1234.5, 3, 1, 'div_k'], 'google row'); eq(g1.rows[1].line, 'sapcr', 'grandparent rights ad group → custody');
const g2 = ACCT.importCSV(`Campaign,Day,Hour of day,Impr.,Clicks,Cost,Conversions\nSEV_ENF_SEARCH,${D3},9,100,5,40.00,1\nSEV_ENF_SEARCH,${D3},19,200,9,60.00,2\n`);
eq(g2.rows.filter(r => r.kind === 'hour').map(r => r.hour), [9, 19], 'hour of day rows'); const g2d = g2.rows.filter(r => r.kind === 'ads'); eq(g2d.length, 1, 'an hourly only report is folded into a daily row'); eq(pick(g2d[0], ['date', 'hour', 'spend', 'clicks', 'leads', 'line']), [D3, null, 100, 14, 3, 'enf'], 'folded daily row');
const g3 = ACCT.importCSV(`Campaign,Day,Postal code,Impr.,Clicks,Cost,Conversions\nSEV_DIV_K_HARRIS,${D3},"77005, Texas, United States",300,10,120,1\nSEV_DIV_K_HARRIS,${D3},"75093, Texas, United States",100,4,30,0\n`);
eq(g3.rows.map(r => r.kind), ['geo', 'geo'], 'user location report rows are geographic'); eq(pick(g3.rows[0].geo, ['zip', 'county', 'cname']), ['77005', '48201', 'Harris'], 'zip and county'); eq(g3.rows[1].geo.county, '48085', 'Collin');

/* ============================ Meta, TikTok, Microsoft ============================ */
const m1 = ACCT.importCSV(`Campaign name,Ad set name,Day,Amount spent (USD),Impressions,Link clicks,Leads,Messaging conversations started\nSEV_PO_HARRIS,Harris County 25 to 54,${D3},55.20,4000,80,4,2\nModification after job loss,Fort Bend parents,${D5},30,2500,40,1,0\n`);
eq(m1.importer.id, 'meta-ui', 'meta export'); eq(pick(m1.rows[0], ['src', 'kind', 'spend', 'imp', 'clicks', 'leads', 'msgs', 'line']), ['meta', 'ads', 55.2, 4000, 80, 4, 2, 'po'], 'meta row'); eq(m1.rows[1].line, 'mod', 'modification by keyword');
const m2 = ACCT.importCSV(`Campaign name,Region,Day,Amount spent (USD),Impressions,Link clicks,Leads\nSEV_PO_HARRIS,Texas,${D3},55.20,4000,80,4\n`); eq(pick(m2.rows[0], ['kind']).concat(m2.rows[0].geo.region), ['geo', 'Texas'], 'meta region breakdown');
const t1 = ACCT.importCSV(`Campaign name,Date,Cost,Impressions,Clicks (destination),CTR (destination),CPC (destination),Conversions\nSEV_DIV_K_TT,${D3},12.50,1000,40,4.00%,0.31,2\nTotal,,12.50,1000,40,,,2\n`);
eq(t1.importer.id, 'tiktok-ui', 'tiktok export'); eq(t1.rows.length, 1, 'total skipped'); eq(pick(t1.rows[0], ['src', 'kind', 'date', 'campaign', 'spend', 'imp', 'clicks', 'leads', 'line']), ['tiktok', 'ads', D3, 'SEV_DIV_K_TT', 12.5, 1000, 40, 2, 'div_k'], 'tiktok row');
const ms1 = ACCT.importCSV(`"Report Name: Campaign performance"\n"Report Time: ${D5} to ${D3}"\n\nCampaignName,AdGroupName,TimePeriod,Impressions,Clicks,Spend,Conversions\nTexas Military Divorce,Fort Bliss,${slash(D3)},500,20,64.10,2\n"Prenup, Dallas",Premarital,${slash(D5)},90,3,9.00,0\n`);
eq(ms1.importer.id, 'microsoft-ui', 'microsoft report'); eq(ms1.rows.map(r => [r.date, r.line, r.spend]), [[D3, 'mil', 64.1], [D5, 'prenup', 9]], 'microsoft rows with US dates and a quoted comma');

/* ============================ Local Services Ads leads export ============================ */
const l1 = ACCT.importCSV(`Lead creation time,Lead type,Job type,Charged,Lead price,Postal code,Lead status,Customer name,Phone number\n${D3} 10:20:00,Phone call,Divorce,Yes,45.00,77002,Booked,Jane Roe,(713) 555-0144\n${D5} 21:05:00,Message,Child custody,No,,78704,New,John Roe,(512) 555-0101\n`);
eq(l1.importer.id, 'lsa', 'LSA export'); eq(pick(l1.rows[0], ['src', 'kind', 'date', 'hour', 'calls', 'msgs', 'conv', 'spend', 'line']), ['lsa', 'lead', D3, 10, 1, 0, 1, 45, 'div_k'], 'charged phone lead'); eq(pick(l1.rows[1], ['hour', 'calls', 'msgs', 'conv', 'spend', 'line']), [21, 0, 1, 0, 0, 'sapcr'], 'message lead'); eq(l1.rows[1].geo.county, '48453', 'LSA postal code → Travis');

/* ============================ YouTube Studio ============================ */
const y1 = ACCT.importCSV(`Content,Video title,Video publish time,Views,Watch time (hours),Subscribers,Impressions,Impressions click-through rate (%)\nTotal,,,620,230.5,12,9000,5.1\nvid1,How custody works in Texas,${D5},500,200.25,10,7000,5.4\n`);
eq(y1.importer.id, 'youtube-studio', 'youtube studio table'); eq(y1.rows.length, 1, 'total skipped'); eq(pick(y1.rows[0], ['src', 'kind', 'date', 'campaign', 'imp', 'conv', 'msgs']), ['youtube', 'social', D5, 'How custody works in Texas', 500, 200.25, 10], 'youtube row');
const y2 = ACCT.importCSV(`Date,Views\n${D3},44\n${D5},31\n`); eq(y2.importer.id, 'youtube-studio', 'chart data'); eq(pick(y2.rows[0], ['date', 'imp', 'kind']), [D3, 44, 'social'], 'chart row');

/* ============================ call tracking ============================ */
const c1 = ACCT.importCSV(`Start Time,Source,Campaign,Keywords,Tracking Number,Customer Name,Customer Phone Number,Customer City,Customer State,Duration (seconds),First-Time Caller,Lead Status,Value\n"${D3} 14:05:33",Google Ads,SEV_ENF_SEARCH,back child support lawyer,(713) 555-0100,Jane Caller,(713) 555-0199,Houston,TX,240,Yes,Good Lead,0\n"${D2} 09:15:00",Google Organic,,custody lawyer near me,(713) 555-0100,Sam Caller,(972) 555-0123,Plano,TX,60,Yes,Not a Lead,\n"${slash(D2)} 6:40 PM",Facebook,Protective order help,,(512) 555-0100,Pat Caller,(512) 555-0177,Austin,TX,300,No,,\n`);
eq(c1.importer.id, 'callrail', 'CallRail export'); eq(c1.rows.length, 3, 'three calls');
eq(pick(c1.rows[0], ['src', 'kind', 'date', 'hour', 'leads', 'calls', 'conv', 'trk', 'chan', 'line']), ['callrail', 'lead', D3, 14, 1, 1, 1, 1, 'google', 'enf'], 'qualified Google Ads call on the enforcement line'); eq(c1.rows[0].geo.county, '48201', 'Houston → Harris');
eq(pick(c1.rows[1], ['hour', 'conv', 'chan', 'line']), [9, 0, 'organic', 'sapcr'], 'organic call, custody keyword'); eq(c1.rows[1].geo.county, '48085', 'Plano → Collin');
eq(pick(c1.rows[2], ['date', 'hour', 'chan', 'line']), [D2, 18, 'meta', 'po'], 'Facebook call at 6:40 PM');
const ctm = ACCT.importCSV(`Called At,Source,Tracking Label,Tracking Number,Receiving Number,Caller Number,Name,City,State,Postal Code,Duration,Talk Time,Status,Tags,Sale Value\n"${D3} 08:02 AM -05:00",Google Ads,Divorce PPC,+17135550100,+17135550111,+19725550123,Chris Caller,Plano,TX,75093,95,80,answered,new client,9500\n"${D5} 13:30 PM -05:00",Avvo,Adoption profile,+17135550100,+17135550111,+17135550188,Lee Caller,Houston,TX,77005,40,30,answered,,\n`);
eq(ctm.importer.id, 'ctm', 'CallTrackingMetrics export'); eq(pick(ctm.rows[0], ['src', 'kind', 'hour', 'calls', 'chan', 'line', 'value']), ['ctm', 'lead', 8, 1, 'google', 'div_k', 9500], 'CTM call'); eq(ctm.rows[0].geo.county, '48085', 'CTM postal code → county'); eq(pick(ctm.rows[1], ['hour', 'chan', 'line']), [13, 'directory', 'adopt'], 'directory call on adoption');
const allText = JSON.stringify(ACCT.S.actuals); ['555-0199', '5550123', 'Jane Caller', 'Chris Caller', 'Jane Roe', '555-0144'].forEach(s => assert(!allText.includes(s), 'nothing identifying stored: ' + s));

/* ============================ intake: Clio Grow and Lawmatics ============================ */
const clio = ACCT.importCSV(`Created,First Name,Last Name,Email,Phone,Practice Area,Referral Source,Status,Value,Zip Code\n${D40},Ana,One,a@example.com,713 555 0101,Family Law - Divorce with Children,Google Ads,Hired,"$9,500",77005\n${D40},Ben,Two,b@example.com,713 555 0102,Custody,Facebook,Not Hired,,77002\n${D20},Cy,Three,c@example.com,713 555 0103,Protective Order,Referral from past client,Consultation Scheduled,,75093\n${D8},Di,Four,d@example.com,713 555 0104,Prenuptial Agreement,Website,Pending,2500,78704\n${D3},Ed,Five,e@example.com,713 555 0105,Divorce,Google,Hired,4500,\n`);
eq(clio.importer.id, 'clio-grow', 'Clio Grow export'); eq(clio.rows.length, 5, 'five inquiries'); assert(/2 retained/.test(clio.note), 'note counts retained: ' + clio.note);
eq(clio.rows.map(r => [r.kind, r.line, r.stage, r.retained, r.chan]), [['intake', 'div_k', 'retained', 1, 'google'], ['intake', 'sapcr', 'lost', 0, 'meta'], ['intake', 'po', 'consult', 0, 'referral'], ['intake', 'prenup', 'open', 0, 'direct'], ['intake', 'div_k', 'retained', 1, 'google']], 'clio rows: line, stage, retained, channel');
eq(pick(clio.rows[0], ['src', 'date', 'campaign', 'adset', 'value', 'leads', 'consult']), ['clio', D40, 'Google Ads', 'Family Law - Divorce with Children', 9500, 1, 1], 'clio row fields'); eq(pick(clio.rows[0].geo, ['zip', 'county']), ['77005', '48201'], 'clio ZIP → county');
assert(!JSON.stringify(clio.rows).includes('example.com') && !JSON.stringify(clio.rows).includes('Ana'), 'no names or emails stored');
const law = ACCT.importCSV(`Created Date,Name,Email,Matter Type,Source,Campaign,Stage,Status,Estimated Value,County\n${D40},Fay Six,f@example.com,Modification,Google Ads,SEV_MOD_SEARCH,Retainer Signed,Hired,4000,Harris\n${D20},Gus Seven,g@example.com,Child Support,Facebook,Lead Gen Form,Consultation Completed,Not Hired,,Fort Bend\n${D8},Hal Eight,h@example.com,Divorce,LSA,,Consultation Scheduled,Pending,,Collin County\n${D3},Ivy Nine,i@example.com,Adoption,Referral,,Intake,Open,,\n`);
eq(law.importer.id, 'lawmatics', 'Lawmatics export (it has a stage column)');
eq(law.rows.map(r => [r.line, r.stage, r.retained, r.chan, r.geo ? r.geo.county : '']), [['mod', 'retained', 1, 'google', '48201'], ['ivd', 'lost', 0, 'meta', '48157'], ['div_k', 'consult', 0, 'lsa', '48085'], ['adopt', 'open', 0, 'referral', '']], 'lawmatics rows: line, stage, channel, county by name');
eq(pick(law.rows[0], ['campaign', 'value', 'note']), ['Google Ads · SEV_MOD_SEARCH', 4000, 'Hired · Retainer Signed'], 'lawmatics source, campaign, value, status');
const forced = ACCT.importCSV(`Created,Practice Area,Status\n${D8},Enforcement,Hired\n`, 'clio-grow'); eq(pick(forced.rows[0], ['line', 'retained', 'chan']), ['enf', 1, 'unknown'], 'a format can be forced when the columns are thin');

/* ============================ generic sheet and the template ============================ */
const tmpl = ACCT.templateCSV(); assert(/^# Generic import template/.test(tmpl) && tmpl.includes('practice area') && tmpl.includes('retained'), 'template');
const gen = ACCT.importCSV(tmpl); eq(gen.importer.id, 'generic', 'template re imports as the generic sheet'); eq(gen.rows.length, 2, 'two template rows');
eq(pick(gen.rows[0], ['src', 'kind', 'date', 'spend', 'leads', 'calls', 'retained', 'value', 'line', 'hasRet']), ['other', 'ads', '2026-09-21', 512.4, 5, 2, 1, 9500, 'div_k', 1], 'generic row with retained and value'); eq(pick(gen.rows[0].geo, ['zip', 'county']), ['77005', '48201'], 'generic ZIP');
eq(pick(gen.rows[1], ['line', 'spend']), ['mod', 380], 'practice area column wins'); eq(gen.rows[1].geo.county, '48157', 'county by name when the ZIP is not in the index');
const lab = ACCT.importCSV(`date,campaign,spend,leads,retained\n${D3},Nextdoor custody posts,80,2,yes\n`, null, 'Nextdoor'); eq(pick(lab.rows[0], ['src', 'line', 'retained']), ['nextdoor', 'sapcr', 1], 'source label and a yes retained cell');
eq(ACCT.importCSV('a,b\n1,2\n').note, 'Columns not recognized; pick the format or start from the template', 'unknown columns'); eq(ACCT.importCSV('').note, 'No rows', 'empty');
const tsv = ACCT.importCSV(`date\tcampaign\tspend\tleads\n${D3}\tSEV_GRAY_SEARCH\t40\t1\n`); eq(pick(tsv.rows[0], ['line', 'spend']), ['gray', 40], 'tab separated');

/* ============================ duplicates, storage, events ============================ */
const again = ACCT.importCSV(`Campaign name,Date,Cost,Impressions,Clicks (destination),CTR (destination),CPC (destination),Conversions\nSEV_DIV_K_TT,${D3},12.50,1000,40,4.00%,0.31,2\n`); eq([again.rows.length, again.dup], [0, 1], 'the same row is not imported twice'); assert(/already held/.test(again.note), 'duplicate note');
await new Promise(r => setTimeout(r, 20)); assert(SETS.some(k => k.includes('sv.accounts.v1')) && LOCAL['sv.accounts.v1'] && LOCAL['sv.accounts.v1'].actuals['import:clio'], 'stored in chrome.storage.local under sv.accounts.v1'); assert(!('accounts.v1' in MEM), 'not in localStorage when the extension storage exists');
assert(EMITS.filter(([e, d]) => e === 'actuals' && d.what === 'actuals').length >= 10, 'BUS actuals after each import'); assert(ACCT.S.imports.length >= 18 && ACCT.S.imports.some(i => i.importer === 'lawmatics' && i.n === 4), 'import log');

/* ============================ analytics over the imports ============================ */
const bl = ACCT.byLine(90); const dk = bl.find(o => o.line === 'div_k');
eq(pick(dk, ['intake', 'retained']), [3, 3], 'divorce with children: 3 intake inquiries, 2 retained in Clio plus 1 retained in the generic sheet'); assert(dk.value === 9500 + 4500 + 9500, 'value of retained matters: ' + dk.value);
assert(dk.spend > 0 && dk.cpr === dk.spend / dk.retained, 'cost per retained matter'); assert(dk.byPlat.google && dk.byPlat.google.intake === 2 && dk.byPlat.google.retained === 2 && dk.byPlat.google.spend > 0, 'Google spend and Google sourced retained matters meet on the line');
eq(pick(bl.find(o => o.line === 'mod'), ['intake', 'retained']), [1, 1], 'modification retained from Lawmatics'); eq(bl.find(o => o.line === 'sapcr').intake, 1, 'custody inquiry');
const bs = ACCT.bySource(90); const bg = bs.find(o => o.src === 'google'); assert(bg.intake === 3 && bg.retained === 3 && bg.tracked === 2 && bg.cpr === bg.spend / 3, 'by source: google spend, tracked calls and retained matters: ' + JSON.stringify(bg)); assert(bs.find(o => o.src === 'referral').intake === 2 && bs.find(o => o.src === 'referral').spend === 0, 'referrals have intake and no spend');
assert(ACCT.byZip(90).some(z => z.zip === '77005' && z.intake >= 1 && z.retained >= 1), 'byZip counts intake and retained'); const bc = ACCT.byCounty(90).find(c => c.county === '48201'); assert(bc && bc.retained >= 2 && bc.cname === 'Harris', 'byCounty: Harris');
const hrs = ACCT.byHour(90); assert(hrs[14].calls >= 1 && hrs[18].calls >= 1 && hrs[10].calls >= 1, 'call and LSA lead hours in the hour chart');
/* retained rate for the desk: 10 decided inquiries minimum; open inquiries younger than 14 days are left out */
const rows = ['Created,Practice Area,Referral Source,Status']; for (let i = 0; i < 12; i++) rows.push(`${dstr(ago(30 + i))},Custody,Google Ads,${i < 3 ? 'Hired' : 'Not Hired'}`); rows.push(`${D2},Custody,Google Ads,Pending`, `${D3},Custody,Google Ads,Consultation Scheduled`, `${D40},Custody,Google Ads,Pending`);
ACCT.importCSV(rows.join('\n') + '\n', 'clio-grow');
const rs = ACCT.rates('sapcr'); eq([rs.intake, rs.retained], [15, 4], 'decided custody inquiries: 12 new, the earlier Clio one, the consult and the old pending one; the young pending one waits; retained adds the Nextdoor sheet'); eq(rs.retain, 20, 'retained rate in percent, from intake only: 3 of 15');
eq(ACCT.rates('prenup').retain, null, 'too few inquiries: no retained rate');
const rg = ACCT.rates('gray'); eq(rg.retain, null, 'generic rows without enough leads give no retained rate');
const p = ACCT.applyToModels(); assert(p.lines.sapcr && p.lines.sapcr.retain === 20 && p.lines.sapcr.n >= 15, 'the custody retained rate is applied: ' + JSON.stringify(p.lines.sapcr));
const pc = ACCT.pacing(10000); assert(pc.plan === 10000 && pc.dim >= 28 && isN(pc.spend), 'pacing'); eq([ACCT.deskPlan().budget, ACCT.deskPlan().cpc], [null, null], 'no desk, no plan'); globalThis.DESKX = { ASM0: { google: { cost: 9.87, cvr: 6, ret: 22 } } }; eq([ACCT.deskPlan().cpc, ACCT.deskPlan().cvr, ACCT.deskPlan().retain, ACCT.deskPlan().from], [9.87, 6, 22, 'the Campaign Desk defaults'], 'desk defaults');
store.set('sev.desk', { budget: 8000, asm: { google: { cost: 11, cvr: 7, ret: 25 } } }); eq([ACCT.deskPlan().budget, ACCT.deskPlan().cpc, ACCT.deskPlan().cvr, ACCT.deskPlan().retain], [8000, 11, 7, 25], 'desk budget and assumptions from sev.desk'); BUS.emit('plan', { budget: 12000, cpc: 9.5, cvr: 6.5, retain: 20, lines: [{ key: 'div_k', budget: 5000, cpc: 9.5 }, { key: 'mod', budget: 2000 }] }); eq([ACCT.deskPlan().budget, ACCT.deskPlan().cpc, ACCT.deskPlan().lines.div_k, ACCT.deskPlan().lines.mod, ACCT.pacing().plan], [12000, 9.5, 5000, 2000, 12000], 'the BUS plan (module 10 payload shape) wins'); await ACCT.setSettings({ plan: 9000 }); eq(ACCT.pacing().plan, 9000, 'a typed plan overrides');
console.log('importers ok');
