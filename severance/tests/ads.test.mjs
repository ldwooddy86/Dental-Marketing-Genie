/* Ad connectors (src/07_accounts_core.js, the ACCT closure) end to end against mock servers: TikTok portal sign in and code exchange,
   Access-Token header, integrated report params, 30 day windows and page_info paging, error codes; Local Services API account and lead
   reports (query string, paging, time zone, spend itemized by lead day and service line) and the GAQL fallback; YouTube Analytics and Data
   with video naming and the Google Ads guard; Google Ads GAQL body and the version probe (404 on v25, 200 on v24); Meta long lived token
   exchange, Login for Business, insights paging.next and the rate limit retry; Microsoft zipped CSV; LinkedIn and the 429 retry; byLine,
   bySource, byHour and rates over everything; the host list against manifest.json. A port of chrome-app/tests/ads.test.mjs with family law
   campaigns and the LINE_META service lines. `node tests/run.mjs ads` */
import fs from 'node:fs';
import path from 'node:path';
import { runFile, root } from './lib/load.mjs';
import { mock, assert, eq } from './lib/mock.mjs';

/* ---------- the globals the classic scripts touch (src/00_core.js, src/01_kit.js and the Severance data indices) ---------- */
const MEM = {};
globalThis.store = { get: (k, d) => (k in MEM ? JSON.parse(MEM[k]) : d), set: (k, v) => { MEM[k] = JSON.stringify(v); } };
const EMITS = [];
globalThis.BUS = { h: {}, on(e, f) { (this.h[e] = this.h[e] || []).push(f); }, emit(e, d) { EMITS.push([e, d]); (this.h[e] || []).forEach(f => f(d)); } };
globalThis.inViewer = () => false;
globalThis.registerModule = () => { };
const isN = v => typeof v === 'number' && isFinite(v); const sum = a => a.reduce((x, y) => x + (y || 0), 0);
globalThis.isN = isN; globalThis.sum = sum; globalThis.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const csvQ = v => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };   /* as in src/01_kit.js */
globalThis.toCSV = (h, rows, note) => (note ? note.split('\n').map(l => '# ' + l).join('\n') + '\n' : '') + h.map(csvQ).join(',') + '\n' + rows.map(r => r.map(csvQ).join(',')).join('\n') + '\n';
globalThis.ZC = [{ zip: '77005', county: '48201', county_name: 'Harris', city: 'Houston', gt: '9040005', acs: { pop: 30000 } }, { zip: '75093', county: '48085', county_name: 'Collin', city: 'Plano', gt: '9040093', acs: { pop: 50000 } }];
globalThis.ZI = {}; ZC.forEach(z => { ZI[z.zip] = z; });
globalThis.CTY = [{ fips: '48201', name: 'Harris' }, { fips: '48085', name: 'Collin' }]; globalThis.CI = {}; CTY.forEach(c => { CI[c.fips] = c; });
let AUTH = null; let authUrl = '';
globalThis.chrome = { runtime: { id: 'test-ext' }, identity: { getRedirectURL: () => 'https://abcdef.chromiumapp.org/', launchWebAuthFlow: async o => AUTH(o.url) } };
runFile('src/25_m06_lines.js');   /* the real LINE_META */
runFile('src/07_accounts_core.js');
const ACCT = globalThis.ACCT; await ACCT.ready();
eq(ACCT.ENV, 'chrome', 'extension runtime detected');
eq(ACCT.KEY, 'sv.accounts.v1', 'storage key');
eq(ACCT.PORDER, ['google', 'lsa', 'youtube', 'meta', 'tiktok', 'microsoft', 'linkedin'], 'provider order');
['rowsAll', 'byLine', 'bySource', 'byHour', 'observedGrid', 'byZip', 'byCounty', 'pacing', 'social', 'rates', 'applied', 'applyToModels', 'revertModels', 'importCSV', 'lineOf', 'settings', 'connect', 'test', 'pull', 'pasteToken', 'status', 'setCfg', 'clearAll', 'disconnect', 'refreshToken'].forEach(k => assert(typeof ACCT[k] === 'function', 'export ' + k));
eq([ACCT.VERS.google.def, ACCT.VERS.google.probe, ACCT.VERS.meta.def, ACCT.VERS.meta.probe, ACCT.VERS.tiktok.def], ['v24', ['v25', 'v24', 'v23'], 'v26.0', ['v27.0', 'v26.0', 'v25.0'], 'v1.3'], 'version constants');
/* every fixed host a provider calls is in HOST_ORIGINS, and every HOST_ORIGINS entry is in manifest.json host_permissions */
const covered = u => { const h = new URL(u).host; return ACCT.HOST_ORIGINS.some(o => { const oh = o.replace(/^https:\/\//, '').replace(/\/\*$/, ''); return oh.startsWith('*.') ? h.endsWith(oh.slice(1)) : h === oh; }); };
Object.entries(ACCT.PROVIDERS).forEach(([p, P]) => ['authUrl', 'tokenUrl', 'apiBase', 'dataBase', 'ccBase'].forEach(k => { if (P[k]) assert(covered(P[k].replace('{ver}', 'v26.0')), `${p}.${k} host in HOST_ORIGINS: ${P[k]}`); }));
assert(covered('https://businessprofileperformance.googleapis.com/v1/locations/1'), 'business profile host');
const man = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')); ACCT.HOST_ORIGINS.forEach(o => assert((man.host_permissions || []).includes(o), 'manifest host_permissions has ' + o));
const src07 = fs.readFileSync(path.join(root, 'src/07_accounts_core.js'), 'utf8'); const hm = src07.match(/HOST_ORIGINS = \[([^\]]+)\]/); assert(hm && (hm[1].match(/'https:\/\/[^']+'/g) || []).length === ACCT.HOST_ORIGINS.length, 'build.mjs can read HOST_ORIGINS');
const dstr = d => d.toISOString().slice(0, 10); const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const TODAY = dstr(new Date()), D3 = dstr(ago(3)), D5 = dstr(ago(5));
eq(ACCT.windows('2026-07-01', '2026-08-29', 30), [{ since: '2026-07-01', until: '2026-07-30' }, { since: '2026-07-31', until: '2026-08-29' }], 'windows of 30 inclusive days');
eq(ACCT.localParts('2026-09-20T21:15:00Z', 'Asia/Tokyo'), { date: '2026-09-21', hour: 6 }, 'time zone conversion');
eq(ACCT.status('google').state, 'unconfigured', 'nothing configured');

/* ============================ TikTok ============================ */
const T = await mock([
  { method: 'POST', path: '/open_api/v1.3/oauth2/access_token/', handler: c => ({ json: c.json && c.json.auth_code === 'code123' && c.json.app_id === 'app1' && c.json.secret === 'sec1' ? { code: 0, message: 'OK', request_id: 'r1', data: { access_token: 'tt-token', advertiser_ids: ['7001', '7002'], scope: [4, 15] } } : { code: 40002, message: 'auth_code invalid', request_id: 'r2', data: {} } }) },
  { method: 'GET', path: '/open_api/v1.3/oauth2/advertiser/get/', handler: c => ({ json: c.headers['access-token'] === 'tt-token' ? { code: 0, message: 'OK', data: { list: [{ advertiser_id: '7001', advertiser_name: 'Test Family Law' }, { advertiser_id: '7002', advertiser_name: 'Second' }] } } : { code: 40105, message: 'Access token is incorrect or has been revoked', data: {} } }) },
  { method: 'GET', path: '/open_api/v1.3/report/integrated/get/', handler: c => { const q = c.query; if (c.headers['access-token'] !== 'tt-token') return { json: { code: 40105, message: 'Access token is incorrect', data: {} } }; if (q.advertiser_id === 'bad') return { json: { code: 40001, message: 'advertiser not authorized', data: {} } }; const dims = JSON.parse(q.dimensions); const hourly = dims.includes('stat_time_hour'); const page = +q.page || 1;
    const list = hourly ? [{ dimensions: { campaign_id: '900', stat_time_hour: `${q.start_date} 13:00:00` }, metrics: { campaign_name: 'SEV_DIV_K_TT', spend: '3.25', impressions: '300', clicks: '12', conversion: '1', cost_per_conversion: '3.25', cpc: '0.27', ctr: '4.0' } }]
      : page === 1 ? [{ dimensions: { campaign_id: '900', stat_time_day: `${q.start_date} 00:00:00` }, metrics: { campaign_name: 'SEV_DIV_K_TT', spend: '12.5', impressions: '1000', clicks: '40', conversion: '2', cost_per_conversion: '6.25', cpc: '0.31', ctr: '4.0' } }]
        : [{ dimensions: { campaign_id: '901', stat_time_day: `${q.end_date} 00:00:00` }, metrics: { campaign_name: 'Uncontested Divorce Flat Fee', spend: '20', impressions: '2000', clicks: '50', conversion: '3', cost_per_conversion: '6.67', cpc: '0.4', ctr: '2.5' } }];
    return { json: { code: 0, message: 'OK', request_id: 'r3', data: { list, page_info: { page, page_size: 1000, total_number: hourly ? 1 : 2, total_page: hourly ? 1 : 2 } } } }; } },
]);
await ACCT.setCfg('tiktok', { appId: 'app1', secret: 'sec1', apiBase: T.url });
eq(ACCT.status('tiktok').state, 'configured', 'configured before connect');
AUTH = url => { authUrl = url; const u = new URL(url); return `${u.searchParams.get('redirect_uri')}?auth_code=code123&state=${u.searchParams.get('state')}`; };
const tt = await ACCT.connect('tiktok');
assert(authUrl.startsWith('https://business-api.tiktok.com/portal/auth?'), 'tiktok portal auth url: ' + authUrl);
const au = new URL(authUrl); eq(au.searchParams.get('app_id'), 'app1', 'app_id'); eq(au.searchParams.get('redirect_uri'), 'https://abcdef.chromiumapp.org/', 'redirect_uri'); assert(au.searchParams.get('state'), 'state present'); assert(!au.searchParams.has('client_id') && !au.searchParams.has('response_type') && !au.searchParams.has('scope'), 'no generic oauth params on the tiktok url');
const ex = T.find('POST', '/open_api/v1.3/oauth2/access_token/'); eq(ex.json, { app_id: 'app1', secret: 'sec1', auth_code: 'code123' }, 'code exchange body'); eq(ex.headers['content-type'], 'application/json', 'json exchange');
eq(tt.access, 'tt-token', 'token stored'); assert(tt.exp > Date.now() + 5 * 365 * 864e5, 'long lived expiry'); eq(tt.advertiserIds, ['7001', '7002'], 'advertiser ids kept'); eq(ACCT.cfg('tiktok').advertiserId, '7001', 'first advertiser stored');
eq(ACCT.status('tiktok').state, 'connected', 'connected'); assert(/long lived/.test(ACCT.status('tiktok').label), 'label: ' + ACCT.status('tiktok').label);
assert(EMITS.some(([e, d]) => e === 'actuals' && d && d.what === 'tokens'), 'BUS actuals emitted after the token change');
/* a state mismatch is refused */
AUTH = url => `${new URL(url).searchParams.get('redirect_uri')}?auth_code=code123&state=forged`; let threw = null; try { await ACCT.connect('tiktok'); } catch (e) { threw = e; } assert(threw && /State mismatch/.test(threw.message), 'state checked');
const tr = await ACCT.test('tiktok'); assert(/v1\.3/.test(tr) && /Test Family Law \(7001\)/.test(tr) && /Second \(7002\)/.test(tr), 'tiktok test: ' + tr);
const ag = T.find('GET', '/open_api/v1.3/oauth2/advertiser/get/'); eq(ag.headers['access-token'], 'tt-token', 'Access-Token header'); eq([ag.query.app_id, ag.query.secret], ['app1', 'sec1'], 'advertiser/get params'); eq(ACCT.cfg('tiktok')._ver, 'v1.3', 'resolved version stored');
const tp = await ACCT.pull('tiktok', 60);
const reps = T.all('GET', '/open_api/v1.3/report/integrated/get/'); const daily = reps.filter(c => JSON.parse(c.query.dimensions).includes('stat_time_day')), hourly = reps.filter(c => JSON.parse(c.query.dimensions).includes('stat_time_hour'));
eq(daily.length, 4, '60 days = 2 windows, 2 pages each'); eq(hourly.length, 2, '2 hourly windows');
const since = dstr(ago(59)); eq([daily[0].query.start_date, daily[0].query.end_date], [since, addDays(since, 29)], 'window 1'); eq([daily[2].query.start_date, daily[2].query.end_date], [addDays(since, 30), TODAY], 'window 2'); eq([daily[0].query.page, daily[1].query.page], ['1', '2'], 'page_info paging');
const q0 = daily[0].query; eq([q0.advertiser_id, q0.report_type, q0.data_level, q0.page_size], ['7001', 'BASIC', 'AUCTION_CAMPAIGN', '1000'], 'report params'); eq(JSON.parse(q0.dimensions), ['campaign_id', 'stat_time_day'], 'daily dimensions'); eq(JSON.parse(q0.metrics), ['campaign_name', 'spend', 'impressions', 'clicks', 'conversion', 'cost_per_conversion', 'cpc', 'ctr'], 'metrics'); eq(JSON.parse(hourly[0].query.dimensions), ['campaign_id', 'stat_time_hour'], 'hourly dimensions'); eq(daily[0].headers['access-token'], 'tt-token', 'report Access-Token');
eq(tp.range, { since, until: TODAY }, 'inclusive range');
const tdRows = tp.rows.filter(r => r.kind === 'ads'); eq(tdRows.length, 4, 'daily rows'); const r0 = tdRows[0]; eq([r0.src, r0.kind, r0.date, r0.hour, r0.campaign, r0.spend, r0.imp, r0.clicks, r0.leads, r0.conv, r0.retained, r0.line], ['tiktok', 'ads', since, null, 'SEV_DIV_K_TT', 12.5, 1000, 40, 2, 2, 0, 'div_k'], 'daily row normalized'); eq(tdRows[1].line, 'div_nk', 'keyword line (uncontested, flat fee)');
const thRows = tp.rows.filter(r => r.kind === 'hour'); eq(thRows.length, 2, 'hourly rows'); eq([thRows[0].src, thRows[0].date, thRows[0].hour, thRows[0].spend, thRows[0].leads], ['tiktok', since, 13, 3.25, 1], 'hourly row normalized');
assert(tp.notes.some(n => /2 windows/.test(n)), 'window note');
await ACCT.setCfg('tiktok', { advertiserId: 'bad' }); threw = null; try { await ACCT.pull('tiktok', 7); } catch (e) { threw = e; } assert(threw && /TikTok 40001: advertiser not authorized/.test(threw.message), 'code !== 0 is an error: ' + (threw && threw.message)); await ACCT.setCfg('tiktok', { advertiserId: '7001' });
eq(await ACCT.refreshToken('tiktok'), null, 'no refresh for tiktok');
assert('accounts.v1' in MEM, 'saved through store under accounts.v1 (localStorage sv.accounts.v1)');

/* ============================ Google Ads ============================ */
const G = await mock([
  { method: 'GET', path: '/v25/customers:listAccessibleCustomers', handler: () => ({ status: 404, json: { error: { code: 404, message: 'Not found' } } }) },
  { method: 'GET', path: '/v24/customers:listAccessibleCustomers', handler: c => c.headers.authorization === 'Bearer g-token' ? { json: { resourceNames: ['customers/111', 'customers/123'] } } : { status: 401, json: { error: { message: 'bad token' } } } },
  { method: 'POST', path: /^\/v24\/customers\/\d+\/googleAds:search$/, handler: c => { const q = c.json.query; const M = (imp, clk, cost, conv, calls) => ({ impressions: String(imp), clicks: String(clk), costMicros: String(cost * 1e6), conversions: String(conv), phoneCalls: String(calls || 0), allConversions: String(conv) });
    if (/FROM local_services_lead/.test(q)) return { json: { results: [{ localServicesLead: { leadType: 'PHONE_CALL', categoryId: 'xcat:service_area_business_lawyer', serviceId: 'xsrv:child_custody', leadStatus: 'NEW', creationDateTime: `${D3} 09:12:00`, leadCharged: true } }] } };
    if (/FROM geographic_view/.test(q)) return { json: { results: [{ campaign: { name: 'SEV_DIV_K_SEARCH' }, segments: { geoTargetPostalCode: 'geoTargetConstants/9040005', date: D3 }, metrics: M(10, 2, 5, 1) }] } };
    const video = /advertising_channel_type IN \('VIDEO', 'DEMAND_GEN'\)/.test(q); const hourlyQ = /segments\.hour/.test(q); const seg = hourlyQ ? { date: D3, hour: 14 } : { date: D3 };
    const rows = [{ campaign: { name: 'Custody rights explained', advertisingChannelType: 'VIDEO' }, segments: seg, metrics: M(4000, 30, 9, 1) }]; if (!video) rows.push({ campaign: { name: 'SEV_DIV_K_SEARCH', advertisingChannelType: 'SEARCH' }, segments: seg, metrics: M(1000, 50, 5, 2, 1) }, { campaign: { name: 'Local Services', advertisingChannelType: 'LOCAL_SERVICES' }, segments: seg, metrics: M(200, 5, 60, 2) });
    return { json: { results: rows } }; } },
]);
eq(ACCT.status('lsa').state, 'unconfigured', 'lsa before anything');
await ACCT.pasteToken('google', 'g-token', 2);
await ACCT.setCfg('google', { clientId: 'cid', clientSecret: 'cs', developerToken: 'dev-tok', customerId: '111', loginCustomerId: '123', apiBase: G.url });
eq(ACCT.status('lsa').state, 'unconfigured', 'lsa with a google token but no manager id'); eq(ACCT.status('youtube').state, 'connected', 'youtube rides the google token'); assert(/Token pasted/.test(ACCT.status('google').label), 'pasted label');
const gt = await ACCT.test('google'); assert(/Google Ads API v24/.test(gt) && /111, 123/.test(gt) && /v25 404/.test(gt), 'google test: ' + gt); eq(ACCT.cfg('google')._ver, 'v24', 'probe fell back to v24');
const probes = G.calls.filter(c => /listAccessibleCustomers/.test(c.path)); eq(probes.slice(0, 2).map(c => c.path.split('/')[1]), ['v25', 'v24'], 'probe order'); assert(!probes.some(c => c.path.startsWith('/v23/')), 'probe stops at the first hit'); eq(probes[0].headers['developer-token'], 'dev-tok', 'probe carries the developer token');
const gp = await ACCT.pull('google', 30);
const gs = G.all('POST', /googleAds:search/); assert(gs.length >= 3, 'daily, hourly and geo queries');
eq(gs[0].path, '/v24/customers/111/googleAds:search', 'search path on the resolved version'); assert(!('pageSize' in gs[0].json), 'no pageSize (PAGE_SIZE_NOT_SUPPORTED since v17)'); eq(Object.keys(gs[0].json), ['query'], 'search body is the query alone'); assert(/^SELECT campaign\.name, campaign\.advertising_channel_type, segments\.date, metrics\.impressions, metrics\.clicks, metrics\.cost_micros, metrics\.conversions, metrics\.phone_calls, metrics\.all_conversions FROM campaign WHERE segments\.date BETWEEN '\d{4}-\d\d-\d\d' AND '\d{4}-\d\d-\d\d' AND metrics\.impressions > 0$/.test(gs[0].json.query), 'daily gaql: ' + gs[0].json.query);
eq([gs[0].headers.authorization, gs[0].headers['developer-token'], gs[0].headers['login-customer-id'], gs[0].headers['content-type']], ['Bearer g-token', 'dev-tok', '123', 'application/json'], 'gaql headers');
assert(/, segments\.hour FROM campaign/.test(gs[1].json.query), 'hourly gaql'); assert(/FROM geographic_view/.test(gs[2].json.query), 'geo gaql');
const gd = gp.rows.filter(r => r.kind === 'ads'); assert(gd.some(r => r.src === 'google' && r.campaign === 'SEV_DIV_K_SEARCH' && r.hour == null && r.spend === 5 && r.leads === 2 && r.calls === 1 && r.line === 'div_k'), 'daily search row'); assert(gd.some(r => r.src === 'youtube' && r.campaign === 'Custody rights explained' && r.line === 'sapcr'), 'video campaign tagged youtube, custody line'); assert(gd.some(r => r.src === 'lsa' && r.spend === 60), 'LSA campaign tagged lsa');
assert(gp.rows.some(r => r.kind === 'hour' && r.hour === 14 && r.src === 'google' && r.date === D3), 'hour rows separate');
const geoRow = gp.rows.find(r => r.kind === 'geo'); eq([geoRow.geo.gid, geoRow.geo.zip, geoRow.geo.county, geoRow.geo.cname, geoRow.spend], ['9040005', '77005', '48201', 'Harris', 5], 'geo row: criteria ID → ZIP → county'); eq(gp.ver, 'v24', 'pull records the version');

/* ============================ Local Services Ads ============================ */
const L = await mock([
  { method: 'GET', path: '/v1/accountReports:search', handler: c => c.headers.authorization !== 'Bearer g-token' ? { status: 401, json: { error: { message: 'unauth' } } } : { json: { accountReports: [{ accountId: '456', businessName: 'Test Family Law', averageWeeklyBudget: 700, averageFiveStarRating: 4.9, totalReview: 312, phoneLeadResponsiveness: 0.92, currentPeriodTotalCost: 340.5, currentPeriodChargedLeads: '2', currentPeriodPhoneCalls: '3', currentPeriodConnectedPhoneCalls: '2', currencyCode: 'USD', impressionsLastTwoDays: '1800' }, { accountId: '457', businessName: 'Other', adSpend: 99, currencyCode: 'USD' }] } } },
  { method: 'GET', path: '/v1/detailedLeadReports:search', handler: c => { if (c.headers.authorization !== 'Bearer g-token') return { status: 401, json: { error: { message: 'unauth' } } };
    if (c.query.pageToken === 'p2') return { json: { detailedLeadReports: [{ leadId: '3', accountId: '456', businessName: 'Test Family Law', leadCreationTimestamp: `${D5}T15:30:00Z`, leadType: 'PHONE_CALL', leadCategory: 'family_law', chargeStatus: 'CHARGED', leadPrice: 40, currencyCode: 'USD', timezone: { id: 'Asia/Tokyo' }, phoneLead: { consumerPhoneNumber: '+17135550100', chargedCallTimestamp: `${D5}T15:31:00Z`, chargedConnectedCallDurationSeconds: '95s' } }] } };
    return { json: { detailedLeadReports: [
      { leadId: '1', accountId: '456', businessName: 'Test Family Law', leadCreationTimestamp: `${D3}T21:15:00Z`, leadType: 'PHONE_CALL', leadCategory: 'family_law', geo: 'Houston, Texas, United States', chargeStatus: 'CHARGED', leadPrice: 42.5, currencyCode: 'USD', disputeStatus: 'NOT_DISPUTED', timezone: { id: 'Asia/Tokyo' }, phoneLead: { consumerPhoneNumber: '+17135550100', chargedCallTimestamp: `${D3}T21:16:00Z`, chargedConnectedCallDurationSeconds: '120s' } },
      { leadId: '2', accountId: '456', businessName: 'Test Family Law', leadCreationTimestamp: `${D3}T14:05:00Z`, leadType: 'MESSAGE', leadCategory: 'family_law', chargeStatus: 'NOT_CHARGED', currencyCode: 'USD', timezone: { id: 'Asia/Tokyo' }, messageLead: { customerName: 'A B', jobType: 'Child custody', postalCode: '77005', consumerPhoneNumber: '+17135550101' } },
      { leadId: '9', accountId: '457', businessName: 'Other', leadCreationTimestamp: `${D3}T10:00:00Z`, leadType: 'MESSAGE', leadCategory: 'criminal_law', chargeStatus: 'CHARGED', leadPrice: 30, currencyCode: 'USD' }], nextPageToken: 'p2' } }; } },
]);
await ACCT.setCfg('lsa', { managerCustomerId: '123', customerId: '456', apiBase: L.url });
eq(ACCT.status('lsa').state, 'connected', 'lsa reads the google token'); assert(/Google sign in/.test(ACCT.status('lsa').label), 'lsa label');
const lt = await ACCT.test('lsa'); assert(/Local Services API v1/.test(lt) && /Test Family Law \(456, weekly budget 700 USD, rating 4\.9\)/.test(lt) && !/Other/.test(lt), 'lsa test: ' + lt);
const lp = await ACCT.pull('lsa', 30);
const lq = L.all('GET', '/v1/detailedLeadReports:search').find(c => !c.query.pageToken); eq(lq.query.query, 'manager_customer_id:123', 'lead query'); const sd = dstr(ago(30)).split('-').map(Number), ed = TODAY.split('-').map(Number);
eq([lq.query['startDate.year'], lq.query['startDate.month'], lq.query['startDate.day'], lq.query['endDate.year'], lq.query['endDate.month'], lq.query['endDate.day'], lq.query.pageSize], [String(sd[0]), String(sd[1]), String(sd[2]), String(ed[0]), String(ed[1]), String(ed[2]), '1000'], 'lead date params'); eq(lq.headers.authorization, 'Bearer g-token', 'google token on the LSA call');
eq(L.all('GET', '/v1/detailedLeadReports:search').filter(c => c.query.pageToken === 'p2').length, 1, 'follows nextPageToken');
const aq = L.all('GET', '/v1/accountReports:search').pop(); eq(aq.query.query, 'manager_customer_id:123', 'account query'); eq(aq.query['startDate.year'], String(sd[0]), 'account date params');
const leads = lp.rows.filter(r => r.kind === 'lead'); eq(leads.length, 3, 'only the configured account, both pages');
const l1 = leads.find(r => r.calls && r.spend === 42.5); eq([l1.src, l1.date, l1.hour, l1.campaign, l1.leads, l1.calls, l1.msgs, l1.conv, l1.line], ['lsa', addDays(D3, 1), 6, 'LSA family_law', 1, 1, 0, 1, 'div_k'], 'charged phone lead in the account time zone, family law → divorce with children'); assert(/CHARGED/.test(l1.note) && /call 120s/.test(l1.note) && !/NOT_DISPUTED/.test(l1.note), 'lead note: ' + l1.note);
assert(!JSON.stringify(lp.rows).includes('5550100') && !JSON.stringify(lp.rows).includes('A B'), 'no consumer phone or name stored');
const l2 = leads.find(r => r.msgs); eq([l2.date, l2.hour, l2.adset, l2.conv, l2.spend, l2.geo.zip, l2.geo.county, l2.line], [D3, 23, 'Child custody', 0, 0, '77005', '48201', 'sapcr'], 'message lead with the postal code, county and the custody line');
const lads = lp.rows.filter(r => r.kind === 'ads'); assert(lads.length && lads.every(r => r.src === 'lsa' && r.campaign === 'LSA account Test Family Law' && r.hour == null), 'account spend rows'); eq(+sum(lads.map(r => r.spend)).toFixed(2), 340.5, 'account spend equals currentPeriodTotalCost');
assert(lads.some(r => r.date === addDays(D3, 1) && r.spend === 42.5 && r.line === 'div_k') && lads.some(r => r.date === addDays(D5, 1) && r.spend === 40), 'itemized by charged lead day and line'); assert(lads.some(r => r.date === TODAY && Math.abs(r.spend - 258) < 0.01 && /not itemized/.test(r.note) && r.line === 'div_k'), 'remainder dated at the end of the range on the most common lead line');
assert(lp.notes.some(n => /Test Family Law: ad spend 340\.50 USD, 2 charged leads, 3 calls \(2 connected\), weekly budget 700, rating 4\.9 \(312 reviews\), phone responsiveness 0\.92/.test(n)), 'account summary note: ' + lp.notes.join(' | '));
assert(ACCT.byZip(90).some(z => z.zip === '77005' && z.leads >= 1 && z.county === '48201'), 'LSA postal code reaches byZip'); assert(ACCT.byCounty(90).some(c => c.county === '48201' && c.cname === 'Harris'), 'and byCounty');
/* the API refuses: fall back to the Google Ads local_services_lead report on the LSA customer under the manager */
await ACCT.setCfg('lsa', { apiBase: L.url + '/nope' }); const lf = await ACCT.pull('lsa', 30);
assert(lf.notes.some(n => /Local Services API detailedLeadReports: 404/.test(n) && /local_services_lead/.test(n)), 'fallback noted: ' + lf.notes.join(' | '));
const fq = G.all('POST', /googleAds:search/).pop(); assert(/FROM local_services_lead WHERE local_services_lead\.creation_date_time >= /.test(fq.json.query), 'fallback gaql'); eq(fq.path, '/v24/customers/456/googleAds:search', 'fallback on the LSA customer'); eq(fq.headers['login-customer-id'], '123', 'fallback under the manager');
const fl = lf.rows.filter(r => r.kind === 'lead'); eq(fl.length, 1, 'fallback lead rows'); eq([fl[0].src, fl[0].date, fl[0].hour, fl[0].calls, fl[0].conv, fl[0].adset, fl[0].line], ['lsa', D3, 9, 1, 1, 'xsrv:child_custody', 'sapcr'], 'fallback lead row');
assert(!lf.rows.some(r => r.kind === 'ads'), 'no account rows when the API is down'); await ACCT.setCfg('lsa', { apiBase: L.url }); await ACCT.pull('lsa', 30);

/* ============================ YouTube ============================ */
const Y = await mock([
  { method: 'GET', path: '/v2/reports', handler: c => { if (c.headers.authorization !== 'Bearer g-token') return { status: 401, json: { error: { message: 'unauth' } } }; if (c.query.dimensions === 'day') return { json: { columnHeaders: [], rows: [[D3, 100, 50, 2, 5, 1, 3], [D5, 80, 40, 1, 2, 0, 1]] } }; if (c.query.dimensions === 'video') return { json: { rows: [['vid1', 500, 200, 10], ['vid2', 120, 30, 2]] } }; return { status: 400, json: { error: { message: 'bad dimensions' } } }; } },
  { method: 'GET', path: '/youtube/v3/videos', handler: c => ({ json: { items: c.query.id.split(',').map(id => ({ id, snippet: { title: id === 'vid1' ? 'How custody works in Texas' : 'Protective orders explained' } })) } }) },
  { method: 'GET', path: '/youtube/v3/channels', handler: () => ({ json: { items: [{ id: 'UC1', snippet: { title: 'Test Family Law' }, statistics: { subscriberCount: '1200', viewCount: '50000', videoCount: '40' } }] } }) },
]);
await ACCT.setCfg('youtube', { apiBase: Y.url });
const yt = await ACCT.test('youtube'); assert(/Test Family Law \(UC1\)/.test(yt) && /1200 subscribers/.test(yt) && /40 videos/.test(yt), 'youtube test: ' + yt); eq(Y.find('GET', '/youtube/v3/channels').query, { part: 'snippet,statistics', mine: 'true' }, 'channels mine=true');
const yp = await ACCT.pull('youtube', 30);
const dq = Y.all('GET', '/v2/reports').find(c => c.query.dimensions === 'day'); eq([dq.query.ids, dq.query.metrics, dq.query.startDate, dq.query.endDate, dq.query.sort], ['channel==MINE', 'views,estimatedMinutesWatched,subscribersGained,likes,comments,shares', dstr(ago(30)), TODAY, 'day'], 'daily analytics query'); eq(dq.headers.authorization, 'Bearer g-token', 'google token on analytics');
const vq = Y.all('GET', '/v2/reports').find(c => c.query.dimensions === 'video'); eq([vq.query.sort, vq.query.maxResults, vq.query.metrics], ['-views', '25', 'views,estimatedMinutesWatched,likes'], 'top videos query');
const nq = Y.find('GET', '/youtube/v3/videos'); eq([nq.query.part, nq.query.id], ['snippet', 'vid1,vid2'], 'video naming call');
const so = yp.rows.filter(r => r.kind === 'social'); assert(so.some(r => r.src === 'youtube' && r.campaign === 'views' && r.date === D3 && r.imp === 100) && so.some(r => r.campaign === 'subscribersGained' && r.date === D3 && r.msgs === 2) && so.some(r => r.campaign === 'shares' && r.date === D5 && r.clicks === 1), 'daily metric rows');
const v1 = so.find(r => r.adset === 'vid1'); eq([v1.campaign, v1.imp, v1.conv, v1.msgs, v1.date], ['How custody works in Texas', 500, 200, 10, TODAY], 'video named through the Data API'); eq(so.find(r => r.adset === 'vid2').campaign, 'Protective orders explained', 'second video named');
assert(so.some(r => r.campaign === 'subscriberCount' && r.msgs === 1200) && so.some(r => r.campaign === 'viewCount' && r.imp === 50000), 'channel statistics rows'); eq(yp.channel.title, 'Test Family Law', 'channel meta');
const ypaid = yp.rows.filter(r => r.kind === 'ads'); assert(ypaid.length === 1 && ypaid[0].src === 'youtube' && ypaid[0].campaign === 'Custody rights explained' && ypaid[0].spend === 9 && ypaid[0].line === 'sapcr', 'paid video rows'); assert(yp.rows.some(r => r.kind === 'hour' && r.src === 'youtube' && r.hour === 14), 'paid video hour rows');
const yq = G.all('POST', /googleAds:search/).filter(c => /VIDEO', 'DEMAND_GEN'/.test(c.json.query)); eq(yq.length, 2, 'day and hour video queries'); assert(/AND campaign\.advertising_channel_type IN \('VIDEO', 'DEMAND_GEN'\) AND metrics\.impressions > 0$/.test(yq[0].json.query), 'restricted gaql: ' + yq[0].json.query);
assert(ACCT.rowsAll('ads').filter(r => r.src === 'youtube').every(r => r._src === 'youtube'), 'google copies of video campaigns dropped once youtube pulled'); assert(ACCT.rowsAll('ads').filter(r => r.src === 'lsa').every(r => r._src === 'lsa'), 'google copies of LSA campaigns dropped once lsa pulled');
const before = G.all('POST', /googleAds:search/).length; await ACCT.setCfg('google', { customerId: '' }); const yp2 = await ACCT.pull('youtube', 30); eq(G.all('POST', /googleAds:search/).length, before, 'no gaql without a customer id'); assert(yp2.rows.some(r => r.kind === 'social') && !yp2.rows.some(r => r.kind === 'ads'), 'organic still pulls'); assert(yp2.notes.some(n => /customer ID/.test(n)), 'guard noted'); await ACCT.setCfg('google', { customerId: '111' }); await ACCT.pull('youtube', 30);

/* ============================ Meta ============================ */
let rl = 0;
const M = await mock([
  { method: 'GET', path: '/v26.0/me', handler: () => ({ json: { id: '10', name: 'Dale' } }) },
  { method: 'GET', path: '/v26.0/me/adaccounts', handler: () => ({ json: { data: [{ account_id: '999', name: 'Test Family Law', account_status: 1 }] } }) },
  { method: 'GET', path: '/v26.0/oauth/access_token', handler: c => c.query.grant_type === 'fb_exchange_token' && c.query.client_id === 'app9' && c.query.client_secret === 's9' && (c.query.fb_exchange_token === 'short-tok' || c.query.fb_exchange_token === 'code-tok') ? { json: { access_token: 'long-tok', token_type: 'bearer', expires_in: 5184000 } } : (c.query.code === 'authcode1' && c.query.client_id === 'app9' && c.query.client_secret === 's9' && c.query.redirect_uri === 'https://abcdef.chromiumapp.org/') ? { json: { access_token: 'code-tok', token_type: 'bearer', expires_in: 5000 } } : { status: 400, json: { error: { message: 'bad exchange', code: 100 } } } },
  { method: 'GET', path: '/v26.0/act_999/insights', handler: c => { const q = c.query; if (q.access_token !== 'long-tok') return { status: 400, json: { error: { message: 'Invalid OAuth access token', code: 190 } } };
    if (q.breakdowns === 'region') { if (!rl++) return { status: 400, json: { error: { message: 'Calls to this API have exceeded the rate limit.', code: 613 } } }; return { json: { data: [{ campaign_name: 'SEV_PO_META', region: 'Texas', spend: '50', impressions: '5000', clicks: '100', actions: [{ action_type: 'lead', value: '4' }] }] } }; }
    if (q.breakdowns) return { json: { data: [{ campaign_name: 'SEV_PO_META', hourly_stats_aggregated_by_advertiser_time_zone: '18:00:00 - 18:59:59', spend: '5', impressions: '500', clicks: '10', actions: [{ action_type: 'lead', value: '1' }] }] } };
    if (q.after === 'pg2') return { json: { data: [{ date_start: D5, date_stop: D5, campaign_name: 'SEV_PO_META', adset_name: 'Harris County 25 to 54', spend: '20', impressions: '2000', clicks: '40', reach: '1500', actions: [{ action_type: 'lead', value: '2' }] }], paging: { cursors: { after: 'end' } } } };
    return { json: { data: [{ date_start: D3, date_stop: D3, campaign_name: 'SEV_PO_META', adset_name: 'Harris County 25 to 54', spend: '30', impressions: '3000', clicks: '60', reach: '2500', actions: [{ action_type: 'lead', value: '3' }, { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '2' }] }], paging: { cursors: { after: 'pg2' }, next: `${M.url}${c.path}?${new URLSearchParams(Object.assign({}, q, { after: 'pg2' }))}` } } }; } },
]);
await ACCT.setCfg('meta', { appId: 'app9', appSecret: 's9', adAccountId: '999', pageId: '', apiBase: M.url, backoffMs: 5 });
AUTH = url => { authUrl = url; const u = new URL(url); return `${u.searchParams.get('redirect_uri')}#access_token=short-tok&expires_in=3600&state=${u.searchParams.get('state')}`; };
const mt = await ACCT.connect('meta');
assert(authUrl.startsWith('https://www.facebook.com/v26.0/dialog/oauth?'), 'meta dialog url on the pinned version: ' + authUrl); const mu = new URL(authUrl); eq([mu.searchParams.get('response_type'), mu.searchParams.get('client_id')], ['token', 'app9'], 'meta implicit params'); assert(mu.searchParams.get('scope').split(',').includes('ads_read'), 'meta scopes comma joined');
const xq = M.find('GET', '/v26.0/oauth/access_token'); eq(xq.query, { grant_type: 'fb_exchange_token', client_id: 'app9', client_secret: 's9', fb_exchange_token: 'short-tok' }, 'long lived exchange query');
eq(mt.access, 'long-tok', 'long lived token stored'); assert(mt.long && mt.exp > Date.now() + 59 * 864e5 && mt.exp < Date.now() + 61 * 864e5, 'about 60 days'); assert(/60 day/.test(ACCT.status('meta').label), 'meta label: ' + ACCT.status('meta').label);
/* Facebook Login for Business: the dialog carries config_id and override_default_response_type; a code answer is redeemed with the app secret, then exchanged for the 60 day token */
await ACCT.setCfg('meta', { configId: 'cfg77' });
AUTH = url => { authUrl = url; const u = new URL(url); return `${u.searchParams.get('redirect_uri')}?code=authcode1&state=${u.searchParams.get('state')}`; };
const mt2 = await ACCT.connect('meta'); const mu2 = new URL(authUrl);
eq([mu2.searchParams.get('config_id'), mu2.searchParams.get('override_default_response_type'), mu2.searchParams.get('response_type')], ['cfg77', 'true', 'token'], 'login for business dialog params');
const redeem = M.all('GET', '/v26.0/oauth/access_token').find(c => c.query.code); assert(redeem && redeem.query.client_id === 'app9' && redeem.query.client_secret === 's9' && redeem.query.redirect_uri === 'https://abcdef.chromiumapp.org/', 'code redeemed with the app secret and the redirect');
eq(mt2.access, 'long-tok', 'code token exchanged for the long lived token');
/* without the app secret a code answer is explained, not swallowed */
await ACCT.setCfg('meta', { appSecret: '' }); threw = null; try { await ACCT.connect('meta'); } catch (e) { threw = e; } assert(threw && /app secret/.test(threw.message), 'code without a secret explained'); await ACCT.setCfg('meta', { appSecret: 's9', configId: '' });
const mtest = await ACCT.test('meta'); assert(/Graph API v26\.0/.test(mtest) && /Dale/.test(mtest) && /60 day token/.test(mtest) && /Test Family Law \(act_999\)/.test(mtest), 'meta test: ' + mtest); eq(ACCT.cfg('meta')._ver, 'v26.0', 'meta version resolved');
assert(M.calls.some(c => c.path === '/v27.0/me'), 'probed v27.0 first'); assert(!M.calls.some(c => c.path === '/v25.0/me'), 'stopped at v26.0');
const mp = await ACCT.pull('meta', 30);
const ins = M.all('GET', '/v26.0/act_999/insights'); const dc = ins.filter(c => !c.query.breakdowns); eq(dc.length, 2, 'followed paging.next'); eq(dc[1].query.after, 'pg2', 'second page cursor'); eq([dc[0].query.level, dc[0].query.time_increment, dc[0].query.limit], ['adset', '1', '500'], 'daily insights params'); eq(JSON.parse(dc[0].query.time_range), { since: dstr(ago(30)), until: TODAY }, 'time_range'); eq(dc[0].query.access_token, 'long-tok', 'long lived token used');
const md = mp.rows.filter(r => r.kind === 'ads'); eq(md.length, 2, 'rows from both pages'); const m3 = md.find(r => r.date === D3); eq([m3.src, m3.campaign, m3.adset, m3.spend, m3.leads, m3.msgs, m3.conv, m3.line], ['meta', 'SEV_PO_META', 'Harris County 25 to 54', 30, 3, 2, 3, 'po'], 'meta row normalized, protective order line from the token');
eq(ins.filter(c => c.query.breakdowns === 'region').length, 2, 'one retry after the 613 rate limit'); assert(mp.rows.some(r => r.kind === 'geo' && r.geo.region === 'Texas' && r.spend === 50), 'region row after the retry'); assert(mp.rows.some(r => r.kind === 'hour' && r.hour === 18 && r.leads === 1), 'hour row'); eq(mp.notes, [], 'no notes'); eq(mp.ver, 'v26.0', 'meta pull records the version');

/* ============================ Microsoft Advertising (Reporting REST v13, zipped CSV) ============================ */
import zlib from 'node:zlib';
const zipOf = (name, text) => { const data = zlib.deflateRawSync(Buffer.from(text)); const nm = Buffer.from(name); const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0, 6); h.writeUInt16LE(8, 8); h.writeUInt32LE(0, 10); h.writeUInt32LE(0, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(text.length, 22); h.writeUInt16LE(nm.length, 26); h.writeUInt16LE(0, 28); return Buffer.concat([h, nm, data]); };
const MSCSV = `"Report Name: severance"\n"Report Time: ${D3} - ${TODAY}"\n\n"TimePeriod","CampaignName","Impressions","Clicks","Spend","Conversions"\n"${D3}|13","SEV_MOD_MS","400","20","8.50","1"\n"${D3}|14","SEV_MOD_MS","600","30","11.50","2"\n"${D5}|9","Military divorce, Fort Bliss","100","5","2.00","0"\n"©2026 Microsoft Corporation. All rights reserved."\n`;
let polls = 0;
const MS = await mock([
  { method: 'POST', path: '/CustomerManagement/v13/User/Query', handler: c => c.headers.authorization === 'Bearer ms-token' && c.headers.developertoken === 'ms-dev' ? { json: { User: { UserName: 'intake@example.com', Id: 7 } } } : { status: 401, json: { Errors: [{ Message: 'unauth' }] } } },
  { method: 'POST', path: '/Reporting/v13/GenerateReport/Submit', handler: c => c.headers.authorization === 'Bearer ms-token' ? { json: { ReportRequestId: 'rr1' } } : { status: 401, json: { Errors: [{ Message: 'unauth' }] } } },
  { method: 'POST', path: '/Reporting/v13/GenerateReport/Poll', handler: () => ({ json: { ReportRequestStatus: ++polls < 2 ? { Status: 'Pending', ReportDownloadUrl: null } : { Status: 'Success', ReportDownloadUrl: `${MS.url}/download/rr1.zip` } } }) },
  { method: 'GET', path: '/download/rr1.zip', handler: () => ({ body: zipOf('severance.csv', MSCSV), headers: { 'Content-Type': 'application/zip' } }) },
]);
await ACCT.pasteToken('microsoft', 'ms-token', 2); await ACCT.setCfg('microsoft', { clientId: 'ms-client', developerToken: 'ms-dev', customerId: '31', accountId: '41', apiBase: MS.url, ccBase: MS.url, pollMs: 5 });
const mst = await ACCT.test('microsoft'); assert(/v13/.test(mst) && /intake@example\.com/.test(mst), 'microsoft test: ' + mst); const uq = MS.find('POST', '/CustomerManagement/v13/User/Query'); eq(uq.json, { UserId: null }, 'user query body'); eq(uq.headers['content-type'], 'application/json', 'user query json');
const msp = await ACCT.pull('microsoft', 30);
const sub = MS.find('POST', '/Reporting/v13/GenerateReport/Submit'); eq([sub.headers.authorization, sub.headers.developertoken, sub.headers.customerid, sub.headers.customeraccountid, sub.headers['content-type']], ['Bearer ms-token', 'ms-dev', '31', '41', 'application/json'], 'reporting headers');
const rr = sub.json.ReportRequest; eq([rr.Type, rr.Format, rr.Aggregation, rr.Columns, rr.Scope, rr.ReturnOnlyCompleteData], ['CampaignPerformanceReportRequest', 'Csv', 'Hourly', ['TimePeriod', 'CampaignName', 'Impressions', 'Clicks', 'Spend', 'Conversions'], { AccountIds: [41] }, false], 'report request'); const s30 = dstr(ago(30)).split('-').map(Number); eq(rr.Time, { CustomDateRangeStart: { Day: s30[2], Month: s30[1], Year: s30[0] }, CustomDateRangeEnd: { Day: ed[2], Month: ed[1], Year: ed[0] } }, 'custom date range');
eq(MS.all('POST', '/Reporting/v13/GenerateReport/Poll').length, 2, 'polled until Success'); eq(MS.find('POST', '/Reporting/v13/GenerateReport/Poll').json, { ReportRequestId: 'rr1' }, 'poll body');
const msh = msp.rows.filter(r => r.kind === 'hour'); eq(msh.length, 3, 'hourly rows from the unzipped csv'); eq([msh[0].src, msh[0].date, msh[0].hour, msh[0].campaign, msh[0].imp, msh[0].clicks, msh[0].spend, msh[0].leads, msh[0].line], ['microsoft', D3, 13, 'SEV_MOD_MS', 400, 20, 8.5, 1, 'mod'], 'hourly row');
const msd = msp.rows.filter(r => r.kind === 'ads'); eq(msd.length, 2, 'folded into one daily row per day and campaign'); const mday = msd.find(r => r.campaign === 'SEV_MOD_MS'); eq([mday.date, mday.hour, mday.imp, mday.clicks, mday.spend, mday.leads], [D3, null, 1000, 50, 20, 3], 'daily fold sums the hours'); eq(msd.find(r => r.campaign === 'Military divorce, Fort Bliss').line, 'mil', 'quoted comma in the campaign name and the military line');
eq(msp.ver, 'v13', 'microsoft version');

/* ============================ LinkedIn (Marketing API 202509) ============================ */
let li429 = 0;
const LI = await mock([
  { method: 'GET', path: '/rest/adAccounts', handler: c => c.headers.authorization === 'Bearer li-token' && c.headers['linkedin-version'] === '202509' ? { json: { elements: [{ id: 555, name: 'Test Family Law Ads' }] } } : { status: 401, json: { message: 'unauth' } } },
  { method: 'GET', path: '/rest/adAnalytics', handler: () => { if (!li429++) return { status: 429, json: { message: 'throttled' } }; return { json: { elements: [{ dateRange: { start: { year: +D3.slice(0, 4), month: +D3.slice(5, 7), day: +D3.slice(8, 10) }, end: { year: +D3.slice(0, 4), month: +D3.slice(5, 7), day: +D3.slice(8, 10) } }, pivotValues: ['urn:li:sponsoredCampaign:77'], impressions: 900, clicks: 12, costInLocalCurrency: '15.5', oneClickLeads: 1, externalWebsiteConversions: 1 }] } }; } },
  { method: 'GET', path: '/rest/organizationalEntityFollowerStatistics', handler: () => ({ json: { elements: [{ followerCountsByAssociationType: [{ followerCounts: { organicFollowerCount: 300, paidFollowerCount: 5 } }, { followerCounts: { organicFollowerCount: 20, paidFollowerCount: 0 } }] }] } }) },
]);
await ACCT.setSettings({ backoffMs: 5 }); await ACCT.pasteToken('linkedin', 'li-token', 2); await ACCT.setCfg('linkedin', { clientId: 'li', clientSecret: 'lis', adAccountId: '555', organizationId: '888', apiBase: LI.url });
const lit = await ACCT.test('linkedin'); assert(/202509/.test(lit) && /Test Family Law Ads \(555\)/.test(lit), 'linkedin test: ' + lit); eq([LI.find('GET', '/rest/adAccounts').query.q, LI.find('GET', '/rest/adAccounts').headers['x-restli-protocol-version']], ['search', '2.0.0'], 'adAccounts search and restli header');
const lip = await ACCT.pull('linkedin', 30);
const aqs = LI.all('GET', '/rest/adAnalytics'); eq(aqs.length, 2, 'one retry after HTTP 429'); const aq1 = aqs[1]; eq([aq1.query.q, aq1.query.pivot, aq1.query.timeGranularity, aq1.headers['linkedin-version'], aq1.headers['x-restli-protocol-version'], aq1.headers.authorization], ['analytics', 'CAMPAIGN', 'DAILY', '202509', '2.0.0', 'Bearer li-token'], 'adAnalytics params and headers');
assert(aq1.url.includes('accounts=List(urn%3Ali%3AsponsoredAccount%3A555)'), 'sponsored account urn: ' + aq1.url); assert(aq1.url.includes(`dateRange=(start:(year:${s30[0]},month:${s30[1]},day:${s30[2]}),end:(year:${ed[0]},month:${ed[1]},day:${ed[2]}))`), 'restli date range: ' + aq1.url); eq(aq1.query.fields, 'impressions,clicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions,dateRange,pivotValues', 'fields');
eq(lip.rows.length, 1, 'one campaign day'); eq([lip.rows[0].src, lip.rows[0].kind, lip.rows[0].date, lip.rows[0].campaign, lip.rows[0].imp, lip.rows[0].clicks, lip.rows[0].spend, lip.rows[0].leads, lip.rows[0].line], ['linkedin', 'ads', D3, 'urn:li:sponsoredCampaign:77', 900, 12, 15.5, 2, ""], 'unnamed linkedin campaign stays unmapped (recruiting and partners, not client matters)');
const fq2 = LI.find('GET', '/rest/organizationalEntityFollowerStatistics'); eq(fq2.query.q, 'organizationalEntity', 'follower stats q'); assert(fq2.url.includes('organizationalEntity=urn%3Ali%3Aorganization%3A888'), 'organization urn'); eq(ACCT.S.actuals.linkedinpage.rows[0].msgs, 320, 'organic followers summed');

/* ============================ analytics over everything ============================ */
const bl = ACCT.byLine(90); const dk = bl.find(o => o.line === 'div_k'); assert(dk, 'divorce with children line');
assert(['tiktok', 'google', 'lsa'].every(p => dk.byPlat[p] && dk.byPlat[p].spend > 0), 'platforms aggregated on the line: ' + Object.keys(dk.byPlat).join(','));
eq(dk.byPlat.tiktok.spend, 12.5 + 12.5, 'tiktok daily spend on the line'); eq(dk.byPlat.google.spend, 5, 'google search spend'); eq(+dk.byPlat.lsa.spend.toFixed(2), 340.5, 'LSA spend from the account rows');
eq(dk.byPlat.lsa.leads + dk.byPlat.lsa.calls, 2, 'each LSA lead counted once'); eq(dk.byPlat.lsa.calls, 2, 'phone leads as calls');
const sp = bl.find(o => o.line === 'sapcr'); assert(sp && sp.byPlat.youtube && sp.byPlat.youtube.spend === 9 && sp.byPlat.lsa.leads === 1, 'custody line holds paid youtube and the LSA message lead');
eq(bl.find(o => o.line === 'po').byPlat.meta.leads, 5, 'meta leads over two pages on the protective order line'); eq(bl.find(o => o.line === 'mod').byPlat.microsoft.spend, 20, 'microsoft daily fold, not the hourly rows'); assert(bl.find(o => o.line === 'unmapped').byPlat.linkedin.leads === 2 && !bl.some(o => o.line === 'high' && o.byPlat.linkedin), 'unnamed linkedin campaigns stay unmapped, off the high asset line'); assert(bl.find(o => o.line === 'div_nk').byPlat.tiktok.spend === 40, 'tiktok second campaign on divorce without children');
const bh = ACCT.byHour(90); assert(bh[13].n >= 2 && bh[14].n >= 2 && bh[18].n >= 1 && bh[6].n >= 1 && bh[23].n >= 1, 'hours from tiktok, google, youtube, meta and LSA leads'); assert(bh[13].spend === 6.5 + 8.5, 'tiktok and microsoft hourly spend at 13');
assert(ACCT.observedGrid() && ACCT.observedGrid().length === 7 && ACCT.observedGrid()[0].length === 6, 'observed grid from hourly rows'); assert(ACCT.pacing(1000).spend >= 0 && ACCT.pacing(1000).plan === 1000, 'pacing runs');
const soc = ACCT.social(60); assert(soc.youtube && soc.youtube.length, 'social rows by source');
const bs = ACCT.bySource(90); const bsG = bs.find(o => o.src === 'google'); assert(bsG && bsG.spend === 5 && bsG.leads === 2 && bsG.calls === 1 && bsG.cpl === 5 / 3, 'by source: google spend and cost per lead'); assert(bs.find(o => o.src === 'lsa').calls === 2, 'by source: LSA calls');
/* rates for the Campaign Desk: thresholds of 50 clicks and 3 leads on Google and Microsoft search rows */
const rk = ACCT.rates('div_k'); eq([rk.line, rk.cpc, rk.cvr, rk.retain, rk.clicks, rk.leads], ['div_k', 0.1, 6, null, 50, 3], 'div_k rates from 50 search clicks and 3 leads; no intake yet'); assert(rk.since <= D3 && rk.until >= D3 && rk.n >= 3, 'since, until and n');
const rm = ACCT.rates('mod'); eq([rm.cpc, rm.cvr], [0.4, 6], 'modification rates from the Microsoft daily fold');
const rmil = ACCT.rates('mil'); eq([rmil.cpc, rmil.cvr], [null, null], 'below the thresholds the figures are null');
const ra = ACCT.rates(); eq([ra.line, ra.clicks, +ra.cpc.toFixed(4), +ra.cvr.toFixed(4)], ['all', 105, +(27 / 105).toFixed(4), +(600 / 105).toFixed(4)], 'all lines together');
EMITS.length = 0; const patch = ACCT.applyToModels(); assert(patch.lines.div_k && patch.lines.div_k.cpc === 0.1 && patch.lines.div_k.cvr === 6 && !('retain' in patch.lines.div_k) && patch.lines.mod && !patch.lines.mil, 'applied patch: ' + JSON.stringify(patch));
eq(ACCT.applied(), patch, 'applied() returns the patch'); await new Promise(r => setTimeout(r, 10)); assert(EMITS.some(([e, d]) => e === 'actuals' && d.what === 'settings'), 'BUS actuals after apply');
assert(ACCT.revertModels() && ACCT.applied() === null, 'revert');
/* ============================ OAuth code flows (Google PKCE with secret and refresh, Microsoft PKCE without secret, LinkedIn secret without PKCE) ============================ */
import crypto from 'node:crypto';
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const OA = await mock([{ method: 'POST', path: /^\/(g|ms|li)\/token$/, handler: c => { const b = Object.fromEntries(new URLSearchParams(c.text)); const who = c.path.split('/')[1]; if (b.grant_type === 'refresh_token') return { json: { access_token: who + '-refreshed', expires_in: 3600 } }; return b.code === who + 'code' ? { json: { access_token: who + '-access', refresh_token: who + '-refresh', expires_in: 3600 } } : { status: 400, json: { error: 'invalid_grant', error_description: 'bad code' } }; } }]);
const saved = {}; ['google', 'microsoft', 'linkedin'].forEach(p => saved[p] = ACCT.PROVIDERS[p].tokenUrl);
ACCT.PROVIDERS.google.tokenUrl = OA.url + '/g/token'; ACCT.PROVIDERS.microsoft.tokenUrl = OA.url + '/ms/token'; ACCT.PROVIDERS.linkedin.tokenUrl = OA.url + '/li/token';
const codeFor = who => url => { authUrl = url; const u = new URL(url); return `${u.searchParams.get('redirect_uri')}?code=${who}code&state=${u.searchParams.get('state')}`; };
AUTH = codeFor('g'); const gtk = await ACCT.connect('lsa');   /* LSA signs in through the Google card */
const ga = new URL(authUrl); assert(authUrl.startsWith('https://accounts.google.com/o/oauth2/v2/auth?'), 'google auth url');
eq([ga.searchParams.get('response_type'), ga.searchParams.get('client_id'), ga.searchParams.get('code_challenge_method'), ga.searchParams.get('access_type'), ga.searchParams.get('prompt')], ['code', 'cid', 'S256', 'offline', 'consent'], 'google auth params'); assert(['https://www.googleapis.com/auth/adwords', 'https://www.googleapis.com/auth/yt-analytics.readonly', 'https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/business.manage'].every(x => ga.searchParams.get('scope').split(' ').includes(x)), 'google scopes space joined');
const gx = Object.fromEntries(new URLSearchParams(OA.all('POST', '/g/token')[0].text)); eq([gx.grant_type, gx.code, gx.redirect_uri, gx.client_id, gx.client_secret], ['authorization_code', 'gcode', 'https://abcdef.chromiumapp.org/', 'cid', 'cs'], 'google code exchange'); eq(b64u(crypto.createHash('sha256').update(gx.code_verifier).digest()), ga.searchParams.get('code_challenge'), 'PKCE verifier matches the challenge');
eq([gtk.access, gtk.refresh], ['g-access', 'g-refresh'], 'google tokens stored'); eq(ACCT.status('lsa').state, 'connected', 'LSA rides the new Google token');
ACCT.S.tokens.google.exp = Date.now() - 1000; eq(ACCT.status('google').state, 'connected', 'expired with a refresh token is still connected'); const gr = await ACCT.refreshToken('youtube'); const grb = Object.fromEntries(new URLSearchParams(OA.all('POST', '/g/token')[1].text)); eq([gr.access, gr.refresh, grb.grant_type, grb.refresh_token, grb.client_id, grb.client_secret], ['g-refreshed', 'g-refresh', 'refresh_token', 'g-refresh', 'cid', 'cs'], 'refresh through a shared card');
AUTH = codeFor('ms'); await ACCT.connect('microsoft'); const ma = new URL(authUrl); assert(authUrl.startsWith('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?') && ma.searchParams.get('code_challenge') && ma.searchParams.get('scope') === 'https://ads.microsoft.com/msads.manage offline_access', 'microsoft auth url: ' + authUrl);
const mx = Object.fromEntries(new URLSearchParams(OA.find('POST', '/ms/token').text)); assert(mx.code_verifier && !('client_secret' in mx) && mx.client_id === 'ms-client', 'microsoft: PKCE, no secret');
AUTH = codeFor('li'); await ACCT.connect('linkedin'); const la = new URL(authUrl); assert(authUrl.startsWith('https://www.linkedin.com/oauth/v2/authorization?') && !la.searchParams.get('code_challenge') && la.searchParams.get('scope') === 'r_ads r_ads_reporting r_organization_social rw_organization_admin', 'linkedin auth url: ' + authUrl);
const lx = Object.fromEntries(new URLSearchParams(OA.find('POST', '/li/token').text)); assert(lx.client_secret === 'lis' && !('code_verifier' in lx), 'linkedin: secret, no PKCE');
AUTH = url => { const u = new URL(url); return `${u.searchParams.get('redirect_uri')}?code=wrong&state=${u.searchParams.get('state')}`; }; threw = null; try { await ACCT.connect('linkedin'); } catch (e) { threw = e; } assert(threw && /bad code/.test(threw.message), 'token exchange error surfaces: ' + (threw && threw.message));
Object.entries(saved).forEach(([p, u]) => { ACCT.PROVIDERS[p].tokenUrl = u; }); await OA.close();

/* ============================ the other environments: a page from disk, the hosted viewer, Firefox (fresh instances in their own contexts) ============================ */
import vm from 'node:vm';
const coreSrc = fs.readFileSync(path.join(root, 'src/07_accounts_core.js'), 'utf8');
const fresh = extra => { const ctx = vm.createContext(Object.assign({ console, fetch, URL, URLSearchParams, crypto: globalThis.crypto, TextEncoder, TextDecoder, setTimeout, clearTimeout, btoa, Intl, Response, Blob, DecompressionStream, navigator: { userAgent: 'Node' }, store: { get: (k, d) => d, set() { } }, BUS: { on() { }, emit() { } }, isN, sum, clamp: globalThis.clamp, inViewer: () => false }, extra || {})); vm.runInContext(coreSrc, ctx, { filename: '07_accounts_core.js' }); return ctx.ACCT; };
const FA = fresh(); eq(FA.ENV, 'file', 'no runtime: file'); threw = null; try { await FA.connect('google'); } catch (e) { threw = e; } assert(threw && /Severance extension/.test(threw.message) && /Paste a token/.test(threw.message), 'file: sign in explained');
await FA.pasteToken('meta', 'tok', 1); await FA.setCfg('meta', { adAccountId: '1', apiBase: 'http://127.0.0.1:1' }); threw = null; try { await FA.pull('meta', 7); } catch (e) { threw = e; } assert(threw && /blocked the call to 127\.0\.0\.1:1/.test(threw.message) && /CORS/.test(threw.message) && /import its report/.test(threw.message), 'file: a blocked call is explained: ' + (threw && threw.message));
const VA = fresh({ inViewer: () => true }); eq(VA.ENV, 'viewer', 'viewer'); threw = null; try { await VA.connect('meta'); } catch (e) { threw = e; } assert(threw && /hosted viewer/.test(threw.message), 'viewer: sign in explained');
const XA = fresh({ browser: { runtime: { id: 'ff' }, identity: { getRedirectURL: () => 'https://ff.extensions.allizom.org/' } }, navigator: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0' } }); eq([XA.ENV, XA.redirectUrl()], ['firefox', 'https://ff.extensions.allizom.org/'], 'firefox runtime');
/* a network failure is explained */
await ACCT.setCfg('linkedin', { apiBase: 'http://127.0.0.1:1' }); threw = null; try { await ACCT.pull('linkedin', 7); } catch (e) { threw = e; } assert(threw && /Could not reach 127\.0\.0\.1:1/.test(threw.message), 'network error explained: ' + (threw && threw.message)); await ACCT.setCfg('linkedin', { apiBase: LI.url });
/* clear tokens keeps the settings and the actuals; clear actuals drops the rows, the imports and the applied corrections */
ACCT.applyToModels(); await ACCT.clearAll('tokens'); eq(Object.keys(ACCT.S.tokens).length, 0, 'tokens cleared'); assert(ACCT.cfg('google').customerId === '111' && ACCT.rowsAll().length > 0, 'settings and actuals kept');
await ACCT.clearAll('actuals'); eq(ACCT.rowsAll().length, 0, 'actuals cleared'); eq(ACCT.applied(), null, 'corrections cleared with the actuals'); eq(ACCT.status('google').state, 'configured', 'google configured, not connected');

await Promise.all([T.close(), G.close(), L.close(), Y.close(), M.close(), MS.close(), LI.close()]);
console.log('ads ok');
