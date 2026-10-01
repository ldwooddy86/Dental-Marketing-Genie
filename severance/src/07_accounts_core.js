/* SEVERANCE accounts core: ACCT, the paid and social connectors, the actuals store, the CSV importers (ad platforms, call tracking,
   law firm intake) and the feedback to the Campaign Desk (module 23). A port of the Thermal Atlas ACCT (chrome-app/src/12_accounts_core.js)
   for one Texas family law firm: campaigns, ad groups and practice areas map to the thirteen LINE_META service lines, geography maps to
   Severance ZIPs and counties, and intake exports (Clio Grow, Lawmatics) add consults and retained matters to the rows.
   Where this runs decides what connects. In the extension (Chrome, Edge, Brave, Firefox) the page has host permissions and the identity
   API, so OAuth sign in and API calls run here with the firm's own developer credentials. Opened as a file, pasted tokens work where the
   API answers browser calls (Meta does, most Google APIs do). Inside the hosted viewer only file imports work. Every credential and every
   row of actuals stays in this browser (chrome.storage.local in the extension, localStorage elsewhere, key sv.accounts.v1) and can be
   cleared from the module. Every provider honours cfg.apiBase (regions, sandboxes, and the Node tests, which point it at mock servers).
   Public API (see docs/CONNECTORS.md):
     ACCT.pull(p, days) → {rows, notes, range}      ACCT.importCSV(text, formatId?, sourceLabel?) → {rows, note, importer}
     ACCT.rowsAll(kind?)  ACCT.byLine(days)  ACCT.bySource(days)  ACCT.byHour(days)  ACCT.byZip(days)  ACCT.byCounty(days)  ACCT.pacing(plan)
     ACCT.rates(line, days) → {cpc, cvr, retain, n, since, ...}   cvr and retain are percents (6.0 means 6%), like the Campaign Desk inputs
     ACCT.applied() → the corrections the user applied to the Campaign Desk, or null.   BUS.emit('actuals', {what}) after every change. */
'use strict';
const ACCT = (() => {
  const G = globalThis;
  const RT = (typeof G.browser !== 'undefined' && G.browser.runtime && G.browser.runtime.id) ? G.browser : (typeof G.chrome !== 'undefined' && G.chrome.runtime && G.chrome.runtime.id) ? G.chrome : null;
  const ENV = RT ? ((typeof G.browser !== 'undefined' && G.browser.runtime && G.browser.runtime.id && /Firefox/.test((G.navigator || {}).userAgent || '')) ? 'firefox' : 'chrome') : (typeof inViewer === 'function' && inViewer()) ? 'viewer' : 'file';
  const KEY = 'sv.accounts.v1';
  /* the fixed API origins the connectors call; build.mjs checks every one against manifest.json host_permissions */
  const HOST_ORIGINS = ['https://accounts.google.com/*', 'https://oauth2.googleapis.com/*', 'https://googleads.googleapis.com/*', 'https://localservices.googleapis.com/*', 'https://youtubeanalytics.googleapis.com/*', 'https://www.googleapis.com/*', 'https://businessprofileperformance.googleapis.com/*', 'https://graph.facebook.com/*', 'https://www.facebook.com/*', 'https://business-api.tiktok.com/*', 'https://ads.tiktok.com/*', 'https://api.linkedin.com/*', 'https://www.linkedin.com/*', 'https://login.microsoftonline.com/*', 'https://*.api.bingads.microsoft.com/*'];
  /* ---------- storage: extension local storage when present, localStorage (through store, which adds the sv. prefix) otherwise ---------- */
  const kv = {
    async get(k, d) { if (RT && RT.storage && RT.storage.local) { try { const r = await RT.storage.local.get(k); return r && r[k] !== undefined ? r[k] : d; } catch (e) { return d; } } return store.get(k.replace(/^sv\./, ''), d); },
    async set(k, v) { if (RT && RT.storage && RT.storage.local) { try { await RT.storage.local.set({ [k]: v }); return; } catch (e) { } } store.set(k.replace(/^sv\./, ''), v); },
  };
  let S = { cfg: {}, tokens: {}, actuals: {}, settings: { useObserved: false, applied: null, range: 30, plan: null }, imports: [] };
  let ready = false;
  const emit = what => { try { BUS.emit('actuals', { what: what || 'all' }); } catch (e) { } };
  const readyP = kv.get(KEY, null).then(v => { if (v && typeof v === 'object') { S = Object.assign(S, v); S.settings = Object.assign({ useObserved: false, applied: null, range: 30, plan: null }, v.settings || {}); } ready = true; emit('load'); });
  const save = what => kv.set(KEY, S).then(() => emit(what));
  /* the Campaign Desk plan as last announced on the bus (BUS.emit('plan', {budget, cpc, cvr, retain, lines})) */
  let lastPlan = null; try { BUS.on('plan', p => { if (p && typeof p === 'object') lastPlan = p; }); } catch (e) { }
  /* ---------- API versions ----------
     Google Ads API: v24 released April 2026 (https://ads-developers.googleblog.com/2026/04/announcing-v24-of-google-ads-api.html), v24.2 June 2026
       (https://ads-developers.googleblog.com/2026/06/announcing-v242-of-google-ads-api.html), v25 July 2026; each major version lives about a year
       (release notes: https://developers.google.com/google-ads/api/docs/release-notes). The probe asks GET {base}/{ver}/customers:listAccessibleCustomers
       (https://developers.google.com/google-ads/api/docs/account-management/listing-accounts) and keeps the first version that is not 404.
     Meta Graph and Marketing API: v26.0 released July 29 2026 (https://developers.facebook.com/docs/graph-api/changelog/); the probe asks GET /{ver}/me.
     TikTok Business API: v1.3 is the single supported line (https://business-api.tiktok.com/portal/docs/reporting-reference/v1.3).
     Local Services API v1 (https://developers.google.com/local-services-ads/guides/reporting). YouTube Analytics v2 (https://developers.google.com/youtube/analytics/reference/reports/query),
     YouTube Data v3 (https://developers.google.com/youtube/v3/docs). Microsoft Advertising Reporting v13, LinkedIn Marketing 202509 unchanged. */
  const VERS = { google: { def: 'v24', probe: ['v25', 'v24', 'v23'] }, meta: { def: 'v26.0', probe: ['v27.0', 'v26.0', 'v25.0'] }, tiktok: { def: 'v1.3' }, lsa: { def: 'v1' }, youtube: { def: 'v2', data: 'v3' }, microsoft: { def: 'v13' }, linkedin: { def: '202509' } };
  /* ---------- providers ----------
     fields: [key, label, {optional, secret}]. tokenOf: the provider whose token this one reuses. kind: 'oauth' (code flow), 'implicit' (token flow),
     'code' (code flow with a JSON exchange, TikTok). idParam and codeParam: the query names when a provider does not use client_id and code. */
  const PROVIDERS = {
    google: { name: 'Google Ads', long: 'Google Ads campaigns, the geographic view and the Business Profile; the sign in also serves Local Services Ads and YouTube', kind: 'oauth', authUrl: 'https://accounts.google.com/o/oauth2/v2/auth', tokenUrl: 'https://oauth2.googleapis.com/token', apiBase: 'https://googleads.googleapis.com', scopes: ['https://www.googleapis.com/auth/adwords', 'https://www.googleapis.com/auth/yt-analytics.readonly', 'https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/business.manage'], pkce: true, secret: true, extra: { access_type: 'offline', prompt: 'consent' },
      fields: [['clientId', 'OAuth client ID (Web application)'], ['clientSecret', 'OAuth client secret'], ['developerToken', 'Google Ads developer token'], ['customerId', 'Google Ads customer ID (digits only)'], ['loginCustomerId', 'Manager account ID (optional)', { optional: true }], ['gbpLocation', 'Business Profile location ID (optional)', { optional: true }]],
      covers: 'Search, Performance Max and Display campaigns by day and by hour, spend and conversions by ZIP (geographic view), phone calls, Business Profile calls, website clicks and direction requests. Video and Demand Gen campaigns land on the YouTube card, Local Services on the LSA card; both use this sign in. Campaign and ad group names map to the service lines.',
      setup: ['console.cloud.google.com: create a project, enable the Google Ads API, Local Services API, YouTube Analytics API, YouTube Data API v3 and Business Profile Performance API.', 'OAuth consent screen: internal or testing, add the firm\'s account emails as test users. Scopes: adwords, yt-analytics.readonly, youtube.readonly, business.manage.', 'Credentials: OAuth client ID, type Web application; add the redirect URL shown at the top of this module.', 'ads.google.com manager account: API Center, apply for a developer token (Basic access covers this use; a test token works only on test accounts).', 'Business Profile API access is a separate request form from Google.'] },
    lsa: { name: 'Local Services Ads', long: 'Local Services API for the firm\'s Google Screened listing: account reports and detailed lead reports under the manager account', kind: 'oauth', tokenOf: 'google', apiBase: 'https://localservices.googleapis.com', scopes: ['https://www.googleapis.com/auth/adwords'],
      fields: [['managerCustomerId', 'Manager account ID that holds the LSA account (digits)'], ['customerId', 'Local Services customer ID (optional; every linked account when blank)', { optional: true }]],
      covers: 'Every lead with its category, job type, type (call, message or booking), charge status and price, by day and by hour of the account time zone; ad spend, weekly budget, rating and responsiveness per account. Charged leads become daily spend rows on the line each lead was matched to. When the Local Services API refuses, the Google Ads local_services_lead report stands in.',
      setup: ['Local Services Ads for lawyers runs under Google Screened: Google verifies each lawyer\'s bar license and runs its background check before the listing serves. The API only reads an account that is already live.', 'The Local Services API reads through a manager account: link the LSA account to a manager account in ads.google.com if it is not already.', 'console.cloud.google.com: enable the Local Services API on the same project as the Google Ads client. It uses the adwords scope, so the Google sign in covers it.', 'Manager account ID: the ten digit manager customer ID. Customer ID: the LSA account\'s own customer ID, only needed when the manager holds several.'] },
    youtube: { name: 'YouTube', long: 'YouTube Analytics and Data API for the firm\'s channel; video and Demand Gen campaigns from Google Ads', kind: 'oauth', tokenOf: 'google', apiBase: 'https://youtubeanalytics.googleapis.com', dataBase: 'https://www.googleapis.com', scopes: ['https://www.googleapis.com/auth/yt-analytics.readonly', 'https://www.googleapis.com/auth/youtube.readonly'],
      fields: [['channelId', 'Channel ID (optional; the signed in channel when blank)', { optional: true }]],
      covers: 'Channel views, minutes watched, subscribers gained, likes, comments and shares by day; the 25 most viewed videos in the range with their titles; channel subscriber, view and video counts; paid video and Demand Gen campaigns by day and hour from Google Ads when a customer ID is set on the Google card.',
      setup: ['console.cloud.google.com: enable the YouTube Analytics API and the YouTube Data API v3 on the Google project.', 'Sign in on the Google card with the account that owns or manages the channel; the yt-analytics.readonly and youtube.readonly scopes are requested there.', 'Channel ID is optional; leave it blank for the signed in channel.'] },
    meta: { name: 'Meta', long: 'Marketing API (Facebook and Instagram ads), Page and Instagram insights', kind: 'implicit', authUrl: 'https://www.facebook.com/{ver}/dialog/oauth', apiBase: 'https://graph.facebook.com', scopes: ['ads_read', 'read_insights', 'pages_read_engagement', 'pages_show_list', 'instagram_basic', 'instagram_manage_insights', 'business_management'], pkce: false, secret: false, pasteHours: 1440,
      fields: [['appId', 'Meta app ID'], ['appSecret', 'App secret (optional; turns the sign in token into a 60 day token and redeems a code)', { optional: true, secret: true }], ['configId', 'Facebook Login for Business configuration ID (optional; required when the app uses Login for Business)', { optional: true }], ['adAccountId', 'Ad account ID (act_ followed by digits)'], ['pageId', 'Facebook Page ID'], ['igUserId', 'Instagram business account ID (optional)', { optional: true }]],
      covers: 'Campaign spend, impressions, clicks, leads, messages and calls by day and by hour of the advertiser time zone; region breakdowns (Meta does not break out ZIP); Page reach and engagement; Instagram reach and followers. Meta has no special ad category for legal services, but the personal attributes policy applies to every family law ad: write to the situation, never "Are you getting divorced?".',
      setup: ['developers.facebook.com: create a Business type app; add Marketing API and Facebook Login for Business.', 'Facebook Login for Business, Configurations: create a configuration with the permissions listed below (Business login, user access token) and paste its configuration ID above; the sign in dialog needs it (config_id). A classic Facebook Login product needs no configuration ID.', 'Facebook Login settings: add the redirect URL shown at the top of this module to Valid OAuth Redirect URIs.', 'App review: ads_read and the insights permissions need Advanced Access for accounts outside the app\'s own business; in development mode the app\'s admins, developers and testers can connect now.', 'App secret (optional): with it the one hour sign in token is exchanged for a 60 day token. System user tokens from Business Manager also work: paste one below.'] },
    tiktok: { name: 'TikTok Ads', long: 'TikTok Business API: auction campaigns by day and by hour', kind: 'code', authUrl: 'https://business-api.tiktok.com/portal/auth', idParam: 'app_id', codeParam: 'auth_code', apiBase: 'https://business-api.tiktok.com', scopes: [], pkce: false, secret: true, pasteHours: 87600,
      fields: [['appId', 'App ID'], ['secret', 'App secret', { secret: true }], ['advertiserId', 'Advertiser ID (optional; the first authorized ad account when blank)', { optional: true }]],
      covers: 'Auction campaigns: spend, impressions, clicks, conversions, cost per conversion, CPC and CTR by day and by hour of the ad account time zone. Reports run in 30 day windows, so a 90 day sync is three requests per report.',
      setup: ['business-api.tiktok.com/portal: create a developer app (Marketing API); scopes Ads Management (read) and Reporting.', 'App settings: Advertiser redirect URL = the redirect URL shown at the top of this module.', 'Connect opens the TikTok authorization page; the ad accounts the user approves come back with the token and the first one is stored as Advertiser ID.', 'TikTok Marketing API tokens are long lived and only stop working when revoked; paste a token generated in the portal if the sign in is not possible.'] },
    microsoft: { name: 'Microsoft Advertising', long: 'Bing and Microsoft Audience Network campaigns', kind: 'oauth', authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', apiBase: 'https://reporting.api.bingads.microsoft.com', ccBase: 'https://clientcenter.api.bingads.microsoft.com', scopes: ['https://ads.microsoft.com/msads.manage', 'offline_access'], pkce: true, secret: false,
      fields: [['clientId', 'Application (client) ID'], ['developerToken', 'Microsoft Advertising developer token'], ['customerId', 'Customer ID'], ['accountId', 'Account ID']],
      covers: 'Campaign performance by day and hour (spend, impressions, clicks, conversions) through the Reporting REST API; the report arrives as a zipped CSV that the page unpacks.',
      setup: ['portal.azure.com: register an application; platform Single page application; add the redirect URL shown at the top of this module.', 'Known limit: Microsoft Entra refuses to redeem the sign in code from a browser extension (its Origin is chrome-extension://, error AADSTS9002326). If Connect ends with that error, paste a token instead: run the Microsoft Advertising OAuth sample or the Bing Ads SDK token script once on your machine with this client ID and paste the access token below (refresh it the same way).', 'ads.microsoft.com: Tools, Developer settings, request a developer token (approved for the account\'s user).', 'Customer ID and Account ID are in the Microsoft Advertising URL (cid and aid).'] },
    linkedin: { name: 'LinkedIn', long: 'Campaign Manager ads, Page followers', kind: 'oauth', authUrl: 'https://www.linkedin.com/oauth/v2/authorization', tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken', apiBase: 'https://api.linkedin.com', scopes: ['r_ads', 'r_ads_reporting', 'r_organization_social', 'rw_organization_admin'], pkce: false, secret: true,
      fields: [['clientId', 'Client ID'], ['clientSecret', 'Client secret'], ['adAccountId', 'Sponsored account ID (digits)'], ['organizationId', 'Organization (Page) ID']],
      covers: 'Campaign impressions, clicks, spend and leads by day; Page follower counts. For a family law firm LinkedIn fits high asset and executive divorce and premarital agreements; campaigns arrive as URNs, so their rows go to the high asset line unless the line is set another way.',
      setup: ['linkedin.com/developers: create an app tied to the firm\'s company Page; request the Advertising API product (partner review) and Community Management API.', 'Auth tab: add the redirect URL shown at the top of this module.'] },
  };
  const PORDER = ['google', 'lsa', 'youtube', 'meta', 'tiktok', 'microsoft', 'linkedin'];
  const redirectUrl = () => { try { return RT && RT.identity && RT.identity.getRedirectURL ? RT.identity.getRedirectURL() : ''; } catch (e) { return ''; } };
  function cfg(p) { return S.cfg[p] || {}; }
  function tok(p) { const P = PROVIDERS[p] || {}; return S.tokens[P.tokenOf || p] || null; }
  const base = p => String(cfg(p).apiBase || (PROVIDERS[p] || {}).apiBase || '').replace(/\/+$/, '');
  const ver = p => cfg(p)._ver || (VERS[p] || {}).def || '';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  /* ---------- fetch with an explanation when the browser blocks the call (CORS from a file, the viewer's sandbox) ---------- */
  async function F(url, opt) {
    try { return await fetch(url, opt); }
    catch (e) {
      let host = url; try { host = new URL(url).host; } catch (_) { }
      if (ENV === 'file') throw new Error(`The browser blocked the call to ${host}: the provider does not answer pages opened from disk or the web (CORS). Use the Severance extension for this provider, or import its report below.`);
      if (ENV === 'viewer') throw new Error(`The hosted viewer blocks calls to ${host}. Import the provider's report instead, or open Severance as the extension.`);
      throw new Error(`Could not reach ${host}: ${e.message}${ENV === 'firefox' ? '. Grant site access at the top of this module.' : ''}`);
    }
  }
  /* ---------- OAuth ---------- */
  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  async function pkce() { const v = b64url(crypto.getRandomValues(new Uint8Array(32))); const c = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))); return { verifier: v, challenge: c }; }
  const expired = t => !t || !t.access || (t.exp && Date.now() > t.exp - 60e3);
  const FAR = () => Date.now() + 10 * 365 * 864e5;
  async function connect(p) {
    const P = PROVIDERS[p]; if (!P) throw new Error('Unknown provider'); if (P.tokenOf) return connect(P.tokenOf);
    const C = cfg(p);
    if (!RT || !RT.identity) throw new Error(ENV === 'viewer' ? 'Sign in cannot run inside the hosted viewer. Import the provider\'s report, or install the Severance extension.' : 'Sign in needs the Severance extension (Chrome, Edge, Brave or Firefox), because a page opened from disk or the web has no registered redirect address. Paste a token instead.');
    const id = C.clientId || C.appId; if (!id) throw new Error('Enter the client or app ID first.');
    const redirect = redirectUrl(); const state = b64url(crypto.getRandomValues(new Uint8Array(12))); let pk = null;
    const q = new URLSearchParams(); q.set(P.idParam || 'client_id', id); q.set('redirect_uri', redirect); q.set('state', state); if ((P.scopes || []).length) q.set('scope', P.scopes.join(p === 'meta' ? ',' : ' '));
    /* Meta: https://www.facebook.com/{ver}/dialog/oauth; with Facebook Login for Business the dialog needs config_id and, to answer with a token instead of a code,
       override_default_response_type=true (https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business). */
    if (P.kind === 'implicit') { q.set('response_type', 'token'); if (p === 'meta' && C.configId) { q.set('config_id', String(C.configId).trim()); q.set('override_default_response_type', 'true'); } }
    else if (P.kind === 'oauth') { q.set('response_type', 'code'); if (P.pkce) { pk = await pkce(); q.set('code_challenge', pk.challenge); q.set('code_challenge_method', 'S256'); } Object.entries(P.extra || {}).forEach(([k, v]) => q.set(k, v)); }
    /* TikTok: https://business-api.tiktok.com/portal/auth?app_id=&state=&redirect_uri= ; the callback carries auth_code and state
       (https://business-api.tiktok.com/portal/docs/marketing-api-authorization/v1.3). */
    const resp = await RT.identity.launchWebAuthFlow({ url: `${P.authUrl.replace('{ver}', ver(p))}?${q}`, interactive: true });
    const u = new URL(resp); const frag = new URLSearchParams(u.hash.replace(/^#/, '')); const qs = u.searchParams;
    if ((frag.get('state') || qs.get('state')) !== state) throw new Error('State mismatch; try again.');
    if (P.kind === 'implicit') {
      let access = frag.get('access_token'); let expires = +frag.get('expires_in') || 3600;
      if (!access && p === 'meta' && qs.get('code')) { /* Login for Business answered with a code: redeem it, GET /{ver}/oauth/access_token?client_id&redirect_uri&client_secret&code (https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow) */
        if (!C.appSecret) throw new Error('Meta answered with a code instead of a token. Enter the app secret (the code is redeemed with it) or fill the configuration ID so the dialog answers with a token.');
        const j = await mj(`${base('meta')}/${ver('meta')}/oauth/access_token?client_id=${encodeURIComponent(C.appId)}&redirect_uri=${encodeURIComponent(redirect)}&client_secret=${encodeURIComponent(C.appSecret)}&code=${encodeURIComponent(qs.get('code'))}`); access = j.access_token; expires = +j.expires_in || 3600; if (!access) throw new Error('Meta: the code exchange returned no token'); }
      if (!access) throw new Error(frag.get('error_description') || qs.get('error_description') || 'No token returned');
      let t = { access, exp: Date.now() + expires * 1000, got: Date.now() }; if (p === 'meta' && C.appSecret) { try { t = await metaLongLived(t); } catch (e) { t.note = 'long lived exchange failed: ' + e.message; } }
      S.tokens[p] = t; await save('tokens'); return t;
    }
    const code = qs.get(P.codeParam || 'code'); if (!code) throw new Error(qs.get('error_description') || qs.get('error') || 'No code returned');
    if (p === 'tiktok') {
      /* POST {base}/open_api/v1.3/oauth2/access_token/ JSON {app_id, secret, auth_code} → data.access_token, data.advertiser_ids, data.scope
         (https://github.com/tiktok/tiktok-business-api-sdk/blob/main/js_sdk/docs/AuthenticationApi.md). Marketing API advertiser tokens are long lived
         (https://business-api.tiktok.com/portal/docs/marketing-api-authorization-faqs/v1.3); expires_in and refresh_token are honoured if they ever appear. */
      const j = await tkPost('/oauth2/access_token/', { app_id: C.appId, secret: C.secret, auth_code: code }); const d = j.data || {}; if (!d.access_token) throw new Error('TikTok: no access token in the exchange response');
      S.tokens[p] = { access: d.access_token, refresh: d.refresh_token || null, exp: d.expires_in ? Date.now() + (+d.expires_in) * 1000 : FAR(), got: Date.now(), advertiserIds: (d.advertiser_ids || []).map(String), scope: d.scope || null };
      if (!C.advertiserId && (d.advertiser_ids || []).length) S.cfg.tiktok = Object.assign(cfg('tiktok'), { advertiserId: String(d.advertiser_ids[0]) });
      await save('tokens'); return S.tokens[p];
    }
    const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirect, client_id: C.clientId }); if (pk) body.set('code_verifier', pk.verifier); if (P.secret && C.clientSecret) body.set('client_secret', C.clientSecret);
    const r = await F(P.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }); const txt = await r.text(); let j = {}; try { j = JSON.parse(txt); } catch (e) { }
    if (!r.ok || j.error) throw new Error(j.error_description || j.error || `Token exchange failed (${r.status})`);
    S.tokens[p] = { access: j.access_token, refresh: j.refresh_token || (tok(p) || {}).refresh, exp: Date.now() + (+j.expires_in || 3600) * 1000, got: Date.now() }; await save('tokens'); return S.tokens[p];
  }
  async function refreshToken(p) {
    const P = PROVIDERS[p]; if (P.tokenOf) return refreshToken(P.tokenOf); const C = cfg(p), t = tok(p); if (!t || !t.refresh) return null;
    if (p === 'tiktok') { const j = await tkPost('/oauth2/refresh_token/', { app_id: C.appId, secret: C.secret, refresh_token: t.refresh, grant_type: 'refresh_token' }); const d = j.data || {}; if (!d.access_token) throw new Error('TikTok: token refresh failed'); S.tokens[p] = Object.assign(t, { access: d.access_token, refresh: d.refresh_token || t.refresh, exp: d.expires_in ? Date.now() + (+d.expires_in) * 1000 : FAR() }); await save('tokens'); return S.tokens[p]; }
    if (!P.tokenUrl) return null;
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: C.clientId }); if (P.secret && C.clientSecret) body.set('client_secret', C.clientSecret);
    const r = await F(P.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }); const txt = await r.text(); let j = {}; try { j = JSON.parse(txt); } catch (e) { }
    if (!r.ok || j.error) throw new Error(j.error_description || `Token refresh failed (${r.status})`);
    S.tokens[p] = Object.assign(t, { access: j.access_token, exp: Date.now() + (+j.expires_in || 3600) * 1000, refresh: j.refresh_token || t.refresh }); await save('tokens'); return S.tokens[p];
  }
  async function access(p) { const P = PROVIDERS[p]; if (P.tokenOf) return access(P.tokenOf); let t = tok(p); if (expired(t) && t && t.refresh) t = await refreshToken(p); if (expired(t)) throw new Error(`${P.name}: not connected or the token expired. Connect again or paste a token.`); return t.access; }
  async function pasteToken(p, accessTok, hours) { const P = PROVIDERS[p]; const k = P.tokenOf || p; const a = String(accessTok || '').trim(); if (!a) throw new Error('Paste a token first'); S.tokens[k] = { access: a, exp: Date.now() + (hours || P.pasteHours || 1) * 36e5, got: Date.now(), pasted: true }; await save('tokens'); }
  async function disconnect(p) { const P = PROVIDERS[p]; if (P.tokenOf) return false; delete S.tokens[p]; await save('tokens'); return true; }
  async function setCfg(p, patch) { S.cfg[p] = Object.assign(cfg(p), patch); await save('cfg'); }
  /* ---------- API helpers ---------- */
  async function J(url, opt, retried) {
    const r = await F(url, opt); if (r.status === 429 && !retried) { await sleep(+S.settings.backoffMs || 2000); return J(url, opt, true); }
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) { }
    if (!r.ok) { const msg = j && (j.error && (j.error.message || j.error.error_description) || j.error_description || j.message || (Array.isArray(j) && j[0] && j[0].error && j[0].error.message) || (Array.isArray(j.Errors) && j.Errors[0] && j.Errors[0].Message)) || txt.slice(0, 200); throw new Error(`${r.status}: ${msg}`); }
    return j;
  }
  const dstr = d => d.toISOString().slice(0, 10); const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const range = n => ({ since: dstr(daysAgo(n)), until: dstr(new Date()) });
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  /* inclusive windows of len days: windows('2026-07-01', '2026-08-29', 30) → [{since:'2026-07-01', until:'2026-07-30'}, {since:'2026-07-31', until:'2026-08-29'}] */
  function windows(since, until, len) { const out = []; let a = since; let g = 0; while (a <= until && g++ < 400) { const b = addDays(a, len - 1); out.push({ since: a, until: b < until ? b : until }); a = addDays(b, 1); } return out; }
  /* a timestamp in an IANA zone → {date, hour}; UTC when the zone is unknown */
  function localParts(ts, tz) { const d = new Date(ts); if (!isN(d.getTime())) return { date: String(ts || '').slice(0, 10), hour: null }; try { const o = {}; new Intl.DateTimeFormat('en-US', Object.assign({ hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' }, tz ? { timeZone: tz } : {})).formatToParts(d).forEach(x => o[x.type] = x.value); return { date: `${o.year}-${o.month}-${o.day}`, hour: +o.hour }; } catch (e) { return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() }; } }
  /* ---------- version probe: the first listed version that answers anything but 404 (or a "version" error) is remembered in cfg._ver ---------- */
  async function resolveVer(p, force) {
    const V = VERS[p]; if (!V || !V.probe) { if (V && !cfg(p)._ver) S.cfg[p] = Object.assign(cfg(p), { _ver: V.def }); return ver(p); } if (!force && cfg(p)._ver) return cfg(p)._ver;
    const a = await access(p); let hit = ''; const tried = [];
    for (const v of V.probe) {
      try { const u = p === 'google' ? `${base('google')}/${v}/customers:listAccessibleCustomers` : `${base('meta')}/${v}/me?access_token=${encodeURIComponent(a)}`; const r = await F(u, { headers: p === 'google' ? gHeaders(a) : {} }); tried.push(`${v} ${r.status}`); if (r.status === 404) continue; let j = null; try { j = JSON.parse(await r.text()); } catch (e) { } if (j && j.error && /version/i.test(j.error.message || '')) continue; hit = v; break; }
      catch (e) { tried.push(`${v} ${e.message}`); }
    }
    await setCfg(p, { _ver: hit || V.def, _probe: tried.join(', ') }); return cfg(p)._ver;
  }
  /* ---------- service line mapping (LINE_META keys) ----------
     1. a line key written as a token (SEV_DIV_K_HOUSTON, TX_MOD_SEARCH, "Harris | sapcr"); the short keys mod, po, high, mil, gray and adopt count only
        in underscore style names, so "High intent" is not the high asset line.
     2. a line's name or short name from LINE_META ("Custody / SAPCR", "Divorce, no kids", the Campaign Desk's campaign names).
     3. keywords, most specific first (English and Spanish): prenup, adoption, CPS, protective order, military, gray, high asset, enforcement,
        modification, divorce without children, divorce with children, child support and paternity, custody.
     4. a generic divorce or family law name maps to divorce with children, the line whose Campaign Desk headline is the generic "[City] Divorce Lawyer".
     Several names (ad group, campaign) are tried in order for 1 to 3 before any falls back to 4. */
  const LKEYS = ['div_k', 'div_nk', 'sapcr', 'mod', 'enf', 'po', 'ivd', 'adopt', 'cps', 'prenup', 'high', 'mil', 'gray'];
  const SHORTK = ['mod', 'po', 'high', 'mil', 'gray', 'adopt'];
  const TOKS = LKEYS.map(k => [k, new RegExp('(^|[^a-z0-9])' + k + '(?=[^a-z0-9]|$)')]);
  const LM = () => (typeof LINE_META !== 'undefined' && LINE_META) ? LINE_META : null;
  const isLine = k => { const m = LM(); return m ? !!m[k] : LKEYS.includes(k); };
  const lineName = k => { const m = LM(); return m && m[k] ? m[k].name : k === 'unmapped' ? 'Unmapped campaigns' : String(k || ''); };
  const KW = [
    ['prenup', /pre ?nup|prenuptial|premarital|pre marital|post ?nup|postnuptial|partition (and exchange )?agreement|marital property agreement|capitulaciones|acuerdo prenupcial/],
    ['adopt', /adopt|adopci/],
    ['cps', /\bcps\b|\bdfps\b|child protective|protective services|removal hearing|child removal|termination of parental|terminat\w* parental|\btpr\b|family preservation|adversary hearing/],
    ['po', /protective order|restraining order|family violence|domestic (violence|abuse)|\bdv\b|stalking|[oó]rden(es)? de protecci|violencia (familiar|dom[eé]stica)/],
    ['mil', /military|militar|deploy|usfspa|\bscra\b|service ?member|fort cavazos|fort hood|fort bliss|\bjbsa\b|\barmy\b|\bnavy\b|air force|marine corps/],
    ['gray', /gr[ae]y divorce|silver divorce|(over|after) (50|fifty|55)|50 and (over|older)|50\+|late (life|in life) divorce|retire|\bqdro|pension|social security|divorcio gris/],
    ['high', /high (net|asset|value|income|worth)|net worth|business owner|executive|complex (property|asset|estate)|stock options?|equity comp|separate property|tracing|valuation|alto patrimonio/],
    ['enf', /enforce|contempt|arrear|back (child )?support|past due (child )?support|unpaid (child )?support|denied (visitation|possession|access)|not following (the )?(order|decree)|desacato/],
    ['mod', /modif|change (of |a |the |my )?(custody|support|order|possession|visitation)|relocat|move away|moving away|(reduce|lower|increase|raise) (child )?support|lost (my |a |your )?job|modificaci/],
    ['div_nk', /(uncontested|agreed|simple|flat fee|flat rate|quick|fast|cheap|affordable|low cost|amicable|no fault|online) divorce|divorce (without|no|with no) (kids|children|minors?)|(no|without) (kids|children)|childless|divorcio (sin hijos|de mutuo acuerdo|sin oposici)/],
    ['div_k', /divorc\w*.*\b(kids?|child|children|custody|parent\w*)|\b(kids?|child|children|custody|parent\w*)\b.*divorc|divorcio con hijos/],
    ['ivd', /paternity|paternidad|\biv ?d\b|attorney general|\boag\b|child support|manutenci|pensi[oó]n alimenticia|dna test/],
    ['sapcr', /custody|custodia|sapcr|conservator|visitation|possession (order|schedule|and access)|fathers?'?s? rights|mothers?'?s? rights|unmarried parent|unwed|grandparent|parental rights|parenting plan|patria potestad/],
  ];
  const GENERIC = /divorc|dissolution|family law|family lawyer|family attorney|derecho familiar|abogad[oa] de familia/;
  let nameIdx = null;
  function names() { const m = LM(); if (!m) return []; if (nameIdx && nameIdx.m === m) return nameIdx.list; const list = []; Object.keys(m).forEach(k => [m[k].name, m[k].short].forEach(n => { if (n && n.length > 5) list.push([String(n).toLowerCase(), k]); })); list.sort((a, b) => b[0].length - a[0].length); nameIdx = { m, list }; return list; }
  function specific(s0) {
    const s = String(s0 || '').toLowerCase(); if (!s.trim()) return '';
    const under = s.includes('_');
    for (const [k, re] of TOKS) { if (SHORTK.includes(k) && !under) continue; if (re.test(s) && isLine(k)) return k; }
    for (const [n, k] of names()) if (s.includes(n)) return k;
    const sp = s.replace(/[_|·/]+/g, ' ');
    for (const [k, re] of KW) if (re.test(sp) && isLine(k)) return k;
    return '';
  }
  function lineOf(...nm) { const list = nm.flat().map(x => String(x == null ? '' : x)).filter(x => x.trim()); for (const s of list) { const k = specific(s); if (k) return k; } for (const s of list) if (GENERIC.test(s.toLowerCase().replace(/_/g, ' '))) return isLine('div_k') ? 'div_k' : ''; return ''; }
  /* ---------- where an inquiry came from: a channel key from a source or campaign label (intake exports, call tracking) ---------- */
  const CHAN = [
    ['lsa', /local services|\blsa\b|google screened|google guaranteed/], ['youtube', /youtube/], ['gbp', /business profile|my business|\bgmb\b|\bgbp\b|google maps|maps listing/],
    ['organic', /organic|\bseo\b|natural search|search engine/], ['google', /google|adwords|\bppc\b|paid search|\bsem\b|\bcpc\b|gclid/],
    ['meta', /facebook|instagram|\bmeta\b|\bfb\b|\big\b|messenger/], ['tiktok', /tik ?tok/], ['microsoft', /bing|microsoft/], ['linkedin', /linked ?in/],
    ['directory', /avvo|justia|findlaw|nolo|martindale|lawyers\.com|super ?lawyers|directory|lawyer referral service|state bar/],
    ['referral', /referr|friend|family member|past client|former client|word of mouth|another attorney|other attorney/], ['yelp', /yelp/], ['nextdoor', /nextdoor/],
    ['direct', /direct|walk ?in|website|web ?form|contact form|live chat|\bchat\b|e ?mail|called the office/],
  ];
  const chanOf = t => { const s = String(t || '').toLowerCase(); if (!s.trim()) return 'unknown'; const hit = CHAN.find(([, re]) => re.test(s)); return hit ? hit[0] : 'other'; };
  /* ---------- intake status → open, consult, retained or lost (Clio Grow, Lawmatics, a generic sheet) ---------- */
  function stageOf(...vals) {
    const t = vals.map(v => String(v == null ? '' : v)).join(' | ').toLowerCase(); if (!t.replace(/[|\s]/g, '')) return 'open';
    if (/not (hired|retained)|no hire|did not (hire|retain)|declined|\blost\b|disqualified|unqualified|not a (fit|good fit)|referred out|\bspam\b|\bdead\b|rejected|went elsewhere|hired (another|someone else|other)|no show/.test(t)) return 'lost';
    if (/\bretained\b|\bhired\b|\bsigned\b|\bengaged\b|\bconverted\b|\bwon\b|became a client|retainer (paid|signed|received)|fee paid|open matter|active matter|^client$/.test(t)) return 'retained';
    if (/consult|scheduled|appointment|meeting|case evaluation|strategy session/.test(t)) return 'consult';
    return 'open';
  }
  /* ---------- geography: a Texas ZIP, its county (FIPS) and city from the Severance indices; a county or city name when there is no ZIP ---------- */
  const ZIP_RE = /\b(7[5-9]\d{3}|885\d{2})\b/;
  let ctyIdx = null, cityIdx = null;
  function countyFips(t) {
    const s = String(t || '').trim(); if (!s) return ''; const has = typeof CI !== 'undefined' && CI;
    if (/^48\d{3}$/.test(s)) return has && !CI[s] ? '' : s;
    if (!ctyIdx && typeof CTY !== 'undefined') { ctyIdx = {}; CTY.forEach(c => { ctyIdx[String(c.name).toLowerCase()] = c.fips; }); }
    return (ctyIdx || {})[s.toLowerCase().replace(/\s+county\b.*$/, '').replace(/,\s*(tx|texas)\b.*$/, '').trim()] || '';
  }
  function cityCounty(t) {
    const s = String(t || '').toLowerCase().replace(/,\s*(tx|texas)\b.*$/, '').trim(); if (!s) return '';
    if (!cityIdx && typeof ZC !== 'undefined') { cityIdx = {}; const best = {}; ZC.forEach(z => { const c = String(z.city || '').toLowerCase(); if (!c) return; const pop = (z.acs && z.acs.pop) || 0; if (!best[c] || pop > best[c]) { best[c] = pop; cityIdx[c] = z.county; } }); }
    return (cityIdx || {})[s] || '';
  }
  function geoOf(g) {
    if (!g || typeof g !== 'object') return null; const o = {};
    const zm = String(g.zip || '').match(ZIP_RE); if (zm) o.zip = zm[1];
    const zi = o.zip && typeof ZI !== 'undefined' ? ZI[o.zip] : null; if (zi) { o.county = zi.county; if (zi.city) o.city = zi.city; }
    if (!o.county && g.county) { const f = countyFips(g.county); if (f) o.county = f; }
    if (!o.county && g.city) { const f = cityCounty(g.city); if (f) o.county = f; }
    if (g.city && !o.city) o.city = String(g.city).trim(); if (g.region) o.region = String(g.region); if (g.gid) o.gid = String(g.gid);
    if (o.county && typeof CI !== 'undefined' && CI[o.county]) o.cname = CI[o.county].name;
    return Object.keys(o).length ? o : null;
  }
  /* ---------- the normalized row ---------- */
  const row = o => { const r = Object.assign({ src: '', kind: 'ads', date: '', hour: null, campaign: '', adset: '', geo: null, imp: 0, clicks: 0, spend: 0, leads: 0, calls: 0, msgs: 0, conv: 0, retained: 0, line: '', note: '' }, o); if (!r.line) r.line = lineOf(r.adset, r.campaign); if (r.geo) r.geo = geoOf(r.geo); return r; };
  /* ---------- Google Ads (GAQL) ---------- */
  /* POST {base}/{ver}/customers/{cid}/googleAds:search {query, pageToken}; headers Authorization, developer-token, login-customer-id
     (https://developers.google.com/google-ads/api/rest/auth, https://developers.google.com/google-ads/api/docs/reporting/overview).
     Never send pageSize: since v17 pages are fixed at 10,000 rows and the API answers PAGE_SIZE_NOT_SUPPORTED when the field is set
     (SearchGoogleAdsRequest.page_size comment, https://github.com/googleapis/googleapis/blob/master/google/ads/googleads/v25/services/google_ads_service.proto). */
  function gHeaders(a, login) { const C = cfg('google'); const h = { Authorization: 'Bearer ' + a, 'developer-token': C.developerToken || '', 'Content-Type': 'application/json' }; const l = String(login || C.loginCustomerId || '').replace(/\D/g, ''); if (l) h['login-customer-id'] = l; return h; }
  async function gaql(query, o) { o = o || {}; const C = cfg('google'); const a = await access('google'); const v = await resolveVer('google'); const h = gHeaders(a, o.login); const cid = String(o.cid || C.customerId || '').replace(/\D/g, ''); if (!cid) throw new Error('Google Ads: enter the customer ID first.'); const out = []; let pageToken = null; do { const j = await J(`${base('google')}/${v}/customers/${cid}/googleAds:search`, { method: 'POST', headers: h, body: JSON.stringify(Object.assign({ query }, pageToken ? { pageToken } : {})) }); (j.results || []).forEach(r => out.push(r)); pageToken = j.nextPageToken || null; } while (pageToken && out.length < 50000); return out; }
  const GSEL = 'campaign.name, campaign.advertising_channel_type, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.phone_calls, metrics.all_conversions';
  const gRow = (r, kind, src) => row({ src, kind, date: r.segments.date, hour: r.segments.hour == null ? null : +r.segments.hour, campaign: r.campaign.name, imp: +r.metrics.impressions || 0, clicks: +r.metrics.clicks || 0, spend: (+r.metrics.costMicros || 0) / 1e6, leads: +r.metrics.conversions || 0, calls: +r.metrics.phoneCalls || 0, conv: +r.metrics.allConversions || 0 });
  /* AdvertisingChannelType enum: SEARCH, DISPLAY, SHOPPING, VIDEO, PERFORMANCE_MAX, LOCAL_SERVICES, DEMAND_GEN, ...
     (https://developers.google.com/google-ads/api/reference/rpc/v23/AdvertisingChannelTypeEnum.AdvertisingChannelType) */
  const gSrc = r => { const t = (r.campaign || {}).advertisingChannelType; return t === 'LOCAL_SERVICES' ? 'lsa' : (t === 'VIDEO' || t === 'DEMAND_GEN') ? 'youtube' : 'google'; };
  async function pullGoogle(n) {
    const R = range(n); const rows = []; const notes = []; const W = `segments.date BETWEEN '${R.since}' AND '${R.until}' AND metrics.impressions > 0`;
    (await gaql(`SELECT ${GSEL} FROM campaign WHERE ${W}`)).forEach(r => rows.push(gRow(r, 'ads', gSrc(r))));
    try { (await gaql(`SELECT ${GSEL}, segments.hour FROM campaign WHERE ${W}`)).forEach(r => rows.push(gRow(r, 'hour', gSrc(r)))); } catch (e) { notes.push('hour segments: ' + e.message); }
    try {
      const geo = await gaql(`SELECT campaign.name, segments.geo_target_postal_code, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM geographic_view WHERE ${W}`);
      const byGid = {}; (typeof ZC !== 'undefined' ? ZC : []).forEach(z => { if (z.gt) byGid[String(z.gt)] = z.zip; });
      geo.forEach(r => { const gid = String(r.segments.geoTargetPostalCode || '').split('/').pop(); rows.push(row({ src: 'google', kind: 'geo', date: r.segments.date, campaign: r.campaign.name, geo: { gid, zip: byGid[gid] || '' }, imp: +r.metrics.impressions || 0, clicks: +r.metrics.clicks || 0, spend: (+r.metrics.costMicros || 0) / 1e6, leads: +r.metrics.conversions || 0 })); });
    } catch (e) { notes.push('geographic_view unavailable: ' + e.message); }
    S.actuals.google = { fetched: new Date().toISOString(), range: R, rows, notes, ver: ver('google') };
    /* GET https://businessprofileperformance.googleapis.com/v1/locations/{id}:fetchMultiDailyMetricsTimeSeries?dailyMetrics=&dailyRange.startDate.year=... (discovery document businessprofileperformance v1) */
    try {
      const C = cfg('google'); if (C.gbpLocation) {
        const a = await access('google'); const st = daysAgo(n), en = new Date(); const q = ['CALL_CLICKS', 'WEBSITE_CLICKS', 'BUSINESS_DIRECTION_REQUESTS', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'].map(m => 'dailyMetrics=' + m).join('&');
        const g = await J(`${String(C.gbpBase || 'https://businessprofileperformance.googleapis.com').replace(/\/+$/, '')}/v1/locations/${encodeURIComponent(String(C.gbpLocation).trim().replace(/^locations\//, ''))}:fetchMultiDailyMetricsTimeSeries?${q}&dailyRange.startDate.year=${st.getFullYear()}&dailyRange.startDate.month=${st.getMonth() + 1}&dailyRange.startDate.day=${st.getDate()}&dailyRange.endDate.year=${en.getFullYear()}&dailyRange.endDate.month=${en.getMonth() + 1}&dailyRange.endDate.day=${en.getDate()}`, { headers: { Authorization: 'Bearer ' + a } });
        const rows3 = []; (g.multiDailyMetricTimeSeries || []).forEach(s => (s.dailyMetricTimeSeries || []).forEach(m => ((m.timeSeries && m.timeSeries.datedValues) || []).forEach(dv => { const d = dv.date; rows3.push(row({ src: 'gbp', kind: 'social', date: `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`, campaign: m.dailyMetric, calls: m.dailyMetric === 'CALL_CLICKS' ? +dv.value || 0 : 0, clicks: m.dailyMetric === 'WEBSITE_CLICKS' ? +dv.value || 0 : 0, conv: m.dailyMetric === 'BUSINESS_DIRECTION_REQUESTS' ? +dv.value || 0 : 0, imp: /IMPRESSIONS/.test(m.dailyMetric) ? +dv.value || 0 : 0 })); })));
        S.actuals.gbp = { fetched: new Date().toISOString(), range: R, rows: rows3 };
      }
    } catch (e) { notes.push('Business Profile: ' + e.message); }
    await save('actuals'); return S.actuals.google;
  }
  /* ---------- Local Services Ads (Local Services API v1, Google token) ---------- */
  /* GET https://localservices.googleapis.com/v1/accountReports:search?query=manager_customer_id:<mcc>&startDate.year=&startDate.month=&startDate.day=&endDate.year=...&pageSize=&pageToken=
     → {accountReports:[{accountId, businessName, averageWeeklyBudget, averageFiveStarRating, totalReview, phoneLeadResponsiveness, currentPeriodTotalCost, currentPeriodChargedLeads,
     currentPeriodPhoneCalls, currentPeriodConnectedPhoneCalls, previousPeriod*, currencyCode, impressionsLastTwoDays, aggregatorInfo}], nextPageToken} (the reporting guide's older
     "adSpend" name is read as a fallback; the discovery document at https://github.com/googleapis/google-api-go-client/blob/main/localservices/v1/localservices-api.json has currentPeriodTotalCost;
     pageSize defaults to 1000, max 10000)
     GET /v1/detailedLeadReports:search?query=manager_customer_id:<mcc>&... → {detailedLeadReports:[{leadId, accountId, businessName, leadCreationTimestamp, leadType (PHONE_CALL|MESSAGE|BOOKING),
     leadCategory, geo, chargeStatus (CHARGED|NOT_CHARGED), leadPrice, currencyCode, disputeStatus, timezone{id}, phoneLead{consumerPhoneNumber, chargedCallTimestamp, chargedConnectedCallDurationSeconds},
     messageLead{customerName, jobType, postalCode, consumerPhoneNumber}, bookingLead{...}}], nextPageToken} (https://developers.google.com/local-services-ads/guides/reporting,
     https://pkg.go.dev/google.golang.org/api/localservices/v1). Scope: adwords (https://developers.google.com/local-services-ads/guides/set-up-and-use-oauth).
     No consumer name or phone number is stored: a lead row keeps its time, category, job type, ZIP, charge and call length. */
  const lsaSpend = A => +(A.currentPeriodTotalCost != null ? A.currentPeriodTotalCost : A.adSpend) || 0;
  const dparts = (s, k) => { const [y, m, d] = s.split('-').map(Number); return `${k}.year=${y}&${k}.month=${m}&${k}.day=${d}`; };
  async function lsaSearch(kind, mcc, R, a) { const out = []; let token = ''; let g = 0; do { const j = await J(`${base('lsa')}/v1/${kind}:search?query=${encodeURIComponent('manager_customer_id:' + mcc)}&${dparts(R.since, 'startDate')}&${dparts(R.until, 'endDate')}&pageSize=1000${token ? '&pageToken=' + encodeURIComponent(token) : ''}`, { headers: { Authorization: 'Bearer ' + a } }); (j[kind] || []).forEach(x => out.push(x)); token = j.nextPageToken || ''; g++; } while (token && g < 20); return out; }
  const lsaLeadRow = L => { const tz = L.timezone && L.timezone.id; const lp = localParts(L.leadCreationTimestamp, tz); const ml = L.messageLead || {}; const pl = L.phoneLead || {}; const charged = L.chargeStatus === 'CHARGED'; const zip = String(ml.postalCode || '').match(/^\d{5}/); const dur = String(pl.chargedConnectedCallDurationSeconds || '').replace(/s$/, ''); return row({ src: 'lsa', kind: 'lead', date: lp.date, hour: lp.hour, campaign: 'LSA ' + (L.leadCategory || ''), adset: ml.jobType || '', geo: zip ? { zip: zip[0] } : null, leads: 1, calls: L.leadType === 'PHONE_CALL' ? 1 : 0, msgs: L.leadType === 'MESSAGE' ? 1 : 0, conv: charged ? 1 : 0, spend: charged ? +L.leadPrice || 0 : 0, note: [L.chargeStatus, L.disputeStatus && L.disputeStatus !== 'NOT_DISPUTED' ? L.disputeStatus : '', dur ? 'call ' + dur + 's' : '', L.leadType === 'BOOKING' ? 'booking' : ''].filter(Boolean).join(' '), line: lineOf(ml.jobType, L.leadCategory) || 'div_k', acct: String(L.accountId || '') }); };
  async function pullLsa(n) {
    const C = cfg('lsa'); const mcc = String(C.managerCustomerId || '').replace(/\D/g, ''); if (!mcc) throw new Error('Local Services Ads: enter the manager account ID that holds the LSA account.'); const own = String(C.customerId || '').replace(/\D/g, ''); const a = await access('lsa'); const R = range(n); const rows = []; const notes = [];
    let leadsOk = false;
    try { (await lsaSearch('detailedLeadReports', mcc, R, a)).filter(L => !own || String(L.accountId) === own).forEach(L => rows.push(lsaLeadRow(L))); leadsOk = true; }
    catch (e) {
      notes.push('Local Services API detailedLeadReports: ' + e.message + '; used the Google Ads local_services_lead report instead');
      try { const leads = await gaql(`SELECT local_services_lead.lead_type, local_services_lead.category_id, local_services_lead.service_id, local_services_lead.lead_status, local_services_lead.creation_date_time, local_services_lead.lead_charged, local_services_lead.locale FROM local_services_lead WHERE local_services_lead.creation_date_time >= '${R.since} 00:00:00'`, { cid: own || cfg('google').customerId, login: mcc }); leads.forEach(r => { const L = r.localServicesLead; rows.push(row({ src: 'lsa', kind: 'lead', date: String(L.creationDateTime || '').slice(0, 10), hour: +String(L.creationDateTime || '').slice(11, 13), campaign: 'LSA ' + (L.categoryId || ''), adset: L.serviceId || '', leads: 1, calls: L.leadType === 'PHONE_CALL' ? 1 : 0, msgs: L.leadType === 'MESSAGE' ? 1 : 0, conv: L.leadCharged ? 1 : 0, note: L.leadStatus, line: lineOf(L.serviceId, L.categoryId) || 'div_k' })); }); }
      catch (e2) { notes.push('local_services_lead fallback: ' + e2.message); }
    }
    try {
      const accts = (await lsaSearch('accountReports', mcc, R, a)).filter(A => !own || String(A.accountId) === own); if (!accts.length) notes.push(`no Local Services account under manager ${mcc}${own ? ' with customer ID ' + own : ''}`);
      accts.forEach(A => {
        const name = 'LSA account ' + (A.businessName || A.accountId || ''); const total = lsaSpend(A); const daily = {}; const mine = rows.filter(r => r.kind === 'lead' && (!r.acct || r.acct === String(A.accountId)));
        /* itemize the account spend by the day and the line of each charged lead; the rest goes to the account's most common lead line, dated at the end of the range */
        if (leadsOk) mine.filter(r => r.spend > 0).forEach(r => { const k = r.date + '|' + r.line; daily[k] = (daily[k] || 0) + r.spend; });
        let placed = 0; Object.entries(daily).sort().forEach(([k, v]) => { const [d, ln] = k.split('|'); rows.push(row({ src: 'lsa', kind: 'ads', date: d, campaign: name, spend: +v.toFixed(2), line: ln || 'div_k' })); placed += v; });
        const cnt = {}; mine.forEach(r => cnt[r.line] = (cnt[r.line] || 0) + 1); const top = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x])[0] || 'div_k';
        const rest = total - placed; if (rest > 0.005 || !Object.keys(daily).length) rows.push(row({ src: 'lsa', kind: 'ads', date: R.until, campaign: name, spend: +Math.max(0, rest).toFixed(2), line: top, note: Object.keys(daily).length ? 'ad spend not itemized by lead, dated at the end of the range' : 'ad spend for the whole range, dated at its end' }));
        notes.push(`${A.businessName || A.accountId}: ad spend ${total.toFixed(2)} ${A.currencyCode || ''}${A.currentPeriodChargedLeads != null ? `, ${A.currentPeriodChargedLeads} charged leads, ${A.currentPeriodPhoneCalls || 0} calls (${A.currentPeriodConnectedPhoneCalls || 0} connected)` : ''}, weekly budget ${A.averageWeeklyBudget != null ? A.averageWeeklyBudget : '?'}, rating ${A.averageFiveStarRating != null ? A.averageFiveStarRating : '?'} (${A.totalReview || 0} reviews), phone responsiveness ${A.phoneLeadResponsiveness != null ? A.phoneLeadResponsiveness : '?'}, impressions last two days ${A.impressionsLastTwoDays != null ? A.impressionsLastTwoDays : '?'}`);
      });
    } catch (e) { notes.push('Local Services API accountReports: ' + e.message); }
    S.actuals.lsa = { fetched: new Date().toISOString(), range: R, rows, notes, ver: 'v1' }; await save('actuals'); return S.actuals.lsa;
  }
  /* ---------- YouTube (Analytics v2 and Data v3 with the Google token; paid video campaigns through GAQL) ---------- */
  /* GET https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate&endDate&metrics&dimensions=day&sort=day ; dimensions=video needs sort and maxResults (max 200)
     (https://developers.google.com/youtube/analytics/reference/reports/query, https://developers.google.com/youtube/analytics/channel_reports).
     GET https://www.googleapis.com/youtube/v3/videos?part=snippet&id=a,b ; GET /youtube/v3/channels?part=snippet,statistics&mine=true (https://developers.google.com/youtube/v3/docs/channels/list). */
  const YTM = ['views', 'estimatedMinutesWatched', 'subscribersGained', 'likes', 'comments', 'shares']; const YSLOT = { views: 'imp', estimatedMinutesWatched: 'conv', subscribersGained: 'msgs', likes: 'conv', comments: 'msgs', shares: 'clicks' };
  async function pullYouTube(n) {
    const C = cfg('youtube'); const a = await access('youtube'); const R = range(n); const rows = []; const notes = []; const ab = base('youtube'); const db = C.apiBase ? base('youtube') : PROVIDERS.youtube.dataBase; const H = { headers: { Authorization: 'Bearer ' + a } }; const ids = encodeURIComponent(C.channelId ? `channel==${C.channelId}` : 'channel==MINE');
    try { const d = await J(`${ab}/v2/reports?ids=${ids}&startDate=${R.since}&endDate=${R.until}&metrics=${YTM.join(',')}&dimensions=day&sort=day`, H); (d.rows || []).forEach(r => YTM.forEach((m, i) => { const o = { src: 'youtube', kind: 'social', date: String(r[0]), campaign: m, line: '' }; o[YSLOT[m]] = +r[i + 1] || 0; rows.push(row(o)); })); } catch (e) { notes.push('channel by day: ' + e.message); }
    try { const v = await J(`${ab}/v2/reports?ids=${ids}&startDate=${R.since}&endDate=${R.until}&metrics=views,estimatedMinutesWatched,likes&dimensions=video&sort=-views&maxResults=25`, H); const vids = v.rows || []; const nm = {}; if (vids.length) { try { const meta = await J(`${db}/youtube/v3/videos?part=snippet&id=${encodeURIComponent(vids.map(r => r[0]).join(','))}`, H); (meta.items || []).forEach(it => nm[it.id] = (it.snippet || {}).title || it.id); } catch (e) { notes.push('video titles: ' + e.message); } } vids.forEach(r => rows.push(row({ src: 'youtube', kind: 'social', date: R.until, campaign: nm[r[0]] || String(r[0]), adset: String(r[0]), imp: +r[1] || 0, conv: +r[2] || 0, msgs: +r[3] || 0 }))); } catch (e) { notes.push('top videos: ' + e.message); }
    let channel = null; try { const c = await J(`${db}/youtube/v3/channels?part=snippet,statistics&${C.channelId ? 'id=' + encodeURIComponent(C.channelId) : 'mine=true'}`, H); const it = (c.items || [])[0]; if (it) { const s = it.statistics || {}; channel = { id: it.id, title: (it.snippet || {}).title || '', subscribers: +s.subscriberCount || 0, views: +s.viewCount || 0, videos: +s.videoCount || 0 }; rows.push(row({ src: 'youtube', kind: 'social', date: R.until, campaign: 'subscriberCount', msgs: channel.subscribers }), row({ src: 'youtube', kind: 'social', date: R.until, campaign: 'viewCount', imp: channel.views }), row({ src: 'youtube', kind: 'social', date: R.until, campaign: 'videoCount', conv: channel.videos })); } else notes.push('no channel on this sign in'); } catch (e) { notes.push('channel statistics: ' + e.message); }
    if (String(cfg('google').customerId || '').replace(/\D/g, '')) { const W = `segments.date BETWEEN '${R.since}' AND '${R.until}' AND campaign.advertising_channel_type IN ('VIDEO', 'DEMAND_GEN') AND metrics.impressions > 0`; try { (await gaql(`SELECT ${GSEL} FROM campaign WHERE ${W}`)).forEach(r => rows.push(gRow(r, 'ads', 'youtube'))); try { (await gaql(`SELECT ${GSEL}, segments.hour FROM campaign WHERE ${W}`)).forEach(r => rows.push(gRow(r, 'hour', 'youtube'))); } catch (e) { notes.push('video campaigns by hour: ' + e.message); } } catch (e) { notes.push('video campaigns from Google Ads: ' + e.message); } }
    else notes.push('no Google Ads customer ID on the Google card; paid video campaigns skipped');
    S.actuals.youtube = { fetched: new Date().toISOString(), range: R, rows, notes, channel, ver: 'analytics v2, data v3' }; await save('actuals'); return S.actuals.youtube;
  }
  /* ---------- Meta ---------- */
  const metaActs = (acts, types) => sum((acts || []).filter(a => types.includes(a.action_type)).map(a => +a.value || 0));
  const META_RL = [4, 17, 32, 613];   /* app, account and ads insights throttles (https://developers.facebook.com/docs/marketing-api/overview/rate-limiting/) */
  async function mj(url) { for (let i = 0; ; i++) { const r = await F(url); const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) { } if (!r.ok || (j && j.error)) { const code = j && j.error && +j.error.code; if (i === 0 && (META_RL.includes(code) || r.status === 429)) { await sleep(+cfg('meta').backoffMs || 30000); continue; } throw new Error(`${r.status}: ${(j && j.error && (j.error.message || j.error.error_description)) || txt.slice(0, 200)}`); } return j; } }
  /* GET {base}/{ver}/oauth/access_token?grant_type=fb_exchange_token&client_id&client_secret&fb_exchange_token → {access_token, token_type, expires_in} (about 60 days)
     (https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/) */
  async function metaLongLived(t) { const C = cfg('meta'); const j = await mj(`${base('meta')}/${ver('meta')}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(C.appId || '')}&client_secret=${encodeURIComponent(C.appSecret || '')}&fb_exchange_token=${encodeURIComponent(t.access)}`); if (!j || !j.access_token) throw new Error('no token in the exchange response'); return { access: j.access_token, exp: Date.now() + (+j.expires_in || 5184000) * 1000, got: Date.now(), long: true }; }
  async function pullMeta(n) {
    const C = cfg('meta'); if (!C.adAccountId) throw new Error('Meta: enter the ad account ID first.'); const a = await access('meta'); const v = await resolveVer('meta'); const R = range(n); const act = String(C.adAccountId || '').startsWith('act_') ? C.adAccountId : 'act_' + C.adAccountId; const rows = []; const notes = []; const Gb = `${base('meta')}/${v}`;
    const tr = encodeURIComponent(JSON.stringify({ since: R.since, until: R.until })); const Fl = 'campaign_name,adset_name,spend,impressions,clicks,reach,actions';
    const page = async u => { const out = []; let next = u; let g = 0; while (next && g < 50) { let j; try { j = await mj(next); } catch (e) { if (!g) throw e; notes.push(`paging stopped after ${g} page${g > 1 ? 's' : ''}: ${e.message}`); break; } (j.data || []).forEach(x => out.push(x)); next = j.paging && j.paging.next; g++; } return out; };
    const LEAD = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'onsite_web_lead'], CALL = ['click_to_call_call_confirm', 'onsite_conversion.click_to_call'], MSG = ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply'];
    const daily = await page(`${Gb}/${act}/insights?level=adset&fields=${Fl}&time_range=${tr}&time_increment=1&limit=500&access_token=${encodeURIComponent(a)}`);
    daily.forEach(x => rows.push(row({ src: 'meta', date: x.date_start, campaign: x.campaign_name, adset: x.adset_name, imp: +x.impressions || 0, clicks: +x.clicks || 0, spend: +x.spend || 0, leads: metaActs(x.actions, LEAD), calls: metaActs(x.actions, CALL), msgs: metaActs(x.actions, MSG), conv: metaActs(x.actions, LEAD) + metaActs(x.actions, CALL) })));
    try { const hourly = await page(`${Gb}/${act}/insights?level=campaign&fields=campaign_name,spend,impressions,clicks,actions&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone&time_range=${tr}&limit=500&access_token=${encodeURIComponent(a)}`); hourly.forEach(x => rows.push(row({ src: 'meta', kind: 'hour', date: R.until, hour: +String(x.hourly_stats_aggregated_by_advertiser_time_zone || '0').slice(0, 2), campaign: x.campaign_name, imp: +x.impressions || 0, clicks: +x.clicks || 0, spend: +x.spend || 0, leads: metaActs(x.actions, LEAD), calls: metaActs(x.actions, CALL), msgs: metaActs(x.actions, MSG) }))); } catch (e) { notes.push('hourly breakdown: ' + e.message); }
    try { const reg = await page(`${Gb}/${act}/insights?level=campaign&fields=campaign_name,spend,impressions,clicks,actions&breakdowns=region&time_range=${tr}&limit=500&access_token=${encodeURIComponent(a)}`); reg.forEach(x => rows.push(row({ src: 'meta', kind: 'geo', date: R.until, campaign: x.campaign_name, geo: { region: x.region }, imp: +x.impressions || 0, clicks: +x.clicks || 0, spend: +x.spend || 0, leads: metaActs(x.actions, LEAD) }))); } catch (e) { notes.push('region breakdown: ' + e.message); }
    S.actuals.meta = { fetched: new Date().toISOString(), range: R, rows, notes, ver: v };
    try {
      if (C.pageId) { const pg = await mj(`${Gb}/${C.pageId}/insights?metric=page_impressions_unique,page_post_engagements,page_fans&period=day&since=${R.since}&until=${R.until}&access_token=${encodeURIComponent(a)}`); const rows2 = []; (pg.data || []).forEach(m => (m.values || []).forEach(v2 => rows2.push(row({ src: 'facebook', kind: 'social', date: String(v2.end_time).slice(0, 10), campaign: m.name, imp: m.name === 'page_impressions_unique' ? +v2.value || 0 : 0, conv: m.name === 'page_post_engagements' ? +v2.value || 0 : 0, msgs: m.name === 'page_fans' ? +v2.value || 0 : 0 })))); S.actuals.facebook = { fetched: new Date().toISOString(), range: R, rows: rows2 }; }
      if (C.igUserId) { const ig = await mj(`${Gb}/${C.igUserId}/insights?metric=reach,follower_count&period=day&since=${R.since}&until=${R.until}&access_token=${encodeURIComponent(a)}`); const rows3 = []; (ig.data || []).forEach(m => (m.values || []).forEach(v2 => rows3.push(row({ src: 'instagram', kind: 'social', date: String(v2.end_time).slice(0, 10), campaign: m.name, imp: m.name === 'reach' ? +v2.value || 0 : 0, msgs: m.name === 'follower_count' ? +v2.value || 0 : 0 })))); S.actuals.instagram = { fetched: new Date().toISOString(), range: R, rows: rows3 }; }
    } catch (e) { notes.push('Page or Instagram insights: ' + e.message); }
    await save('actuals'); return S.actuals.meta;
  }
  /* ---------- TikTok Ads (Business API v1.3) ---------- */
  /* Base https://business-api.tiktok.com/open_api/v1.3 ; header Access-Token on every call; every body is {code (0 = ok), message, request_id, data}
     (https://business-api.tiktok.com/portal/docs/reporting-guides/v1.3, https://www.postman.com/tiktok/tiktok-api-for-business/documentation/efqhadc/tiktok-business-api-v1-3). */
  const TK = '/open_api/v1.3';
  const tkParse = (r, txt, what) => { let j = null; try { j = JSON.parse(txt); } catch (e) { } if (!j || typeof j.code !== 'number') throw new Error(`TikTok ${what}: ${r.status} ${txt.slice(0, 160).replace(/\s+/g, ' ')}`); if (j.code !== 0) throw new Error(`TikTok ${j.code}: ${j.message || 'error'}`); return j; };
  async function tkPost(path, body) { const r = await F(`${base('tiktok')}${TK}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return tkParse(r, await r.text(), path); }
  async function tkGet(path, params) { const a = await access('tiktok'); const q = new URLSearchParams(); Object.entries(params || {}).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v)); }); const r = await F(`${base('tiktok')}${TK}${path}?${q}`, { headers: { 'Access-Token': a } }); return tkParse(r, await r.text(), path); }
  /* GET /report/integrated/get/ advertiser_id, report_type=BASIC, data_level=AUCTION_CAMPAIGN, dimensions (JSON array), metrics (JSON array), start_date, end_date (30 days at most), page, page_size
     → data.list[{dimensions:{campaign_id, stat_time_day|stat_time_hour}, metrics:{campaign_name, spend, ...}}], data.page_info{page, page_size, total_number, total_page}
     (https://business-api.tiktok.com/portal/docs/reporting-reference/v1.3) */
  const TKM = ['campaign_name', 'spend', 'impressions', 'clicks', 'conversion', 'cost_per_conversion', 'cpc', 'ctr'];
  async function tkReport(adv, dims, w) { const out = []; let page = 1, total = 1; do { const j = await tkGet('/report/integrated/get/', { advertiser_id: adv, report_type: 'BASIC', data_level: 'AUCTION_CAMPAIGN', dimensions: dims, metrics: TKM, start_date: w.since, end_date: w.until, page_size: 1000, page }); const d = j.data || {}; (d.list || []).forEach(x => out.push(x)); total = +((d.page_info || {}).total_page) || 1; page++; } while (page <= total && page <= 50); return out; }
  const tkRow = (x, kind) => { const dm = x.dimensions || {}, m = x.metrics || {}; const ts = String((kind === 'hour' ? dm.stat_time_hour : dm.stat_time_day) || ''); return row({ src: 'tiktok', kind, date: ts.slice(0, 10), hour: kind === 'hour' ? +ts.slice(11, 13) : null, campaign: m.campaign_name || String(dm.campaign_id || ''), imp: +m.impressions || 0, clicks: +m.clicks || 0, spend: +m.spend || 0, leads: +m.conversion || 0, conv: +m.conversion || 0, note: m.cost_per_conversion != null ? `cpa ${m.cost_per_conversion} cpc ${m.cpc} ctr ${m.ctr}` : '' }); };
  async function pullTikTok(n) {
    const C = cfg('tiktok'); const t = tok('tiktok') || {}; const adv = String(C.advertiserId || (t.advertiserIds || [])[0] || '').trim(); if (!adv) throw new Error('TikTok Ads: no advertiser ID. Connect (the first authorized ad account is stored) or enter one.');
    const R = { since: dstr(daysAgo(n - 1)), until: dstr(new Date()) }; const rows = []; const notes = []; const W = windows(R.since, R.until, 30);
    for (const w of W) { (await tkReport(adv, ['campaign_id', 'stat_time_day'], w)).forEach(x => rows.push(tkRow(x, 'ads'))); try { (await tkReport(adv, ['campaign_id', 'stat_time_hour'], w)).forEach(x => rows.push(tkRow(x, 'hour'))); } catch (e) { notes.push(`hourly ${w.since} to ${w.until}: ${e.message}`); } }
    if (W.length > 1) notes.push(`${W.length} windows of 30 days`);
    S.actuals.tiktok = { fetched: new Date().toISOString(), range: R, rows, notes, ver: 'v1.3', advertiserId: adv }; await save('actuals'); return S.actuals.tiktok;
  }
  /* ---------- Microsoft Advertising (Reporting REST) ---------- */
  async function inflateZipCsv(buf) { const dv = new DataView(buf); let off = 0; const u8 = new Uint8Array(buf); while (off + 30 <= u8.length && dv.getUint32(off, true) === 0x04034b50) { const method = dv.getUint16(off + 8, true), csz = dv.getUint32(off + 18, true), nlen = dv.getUint16(off + 26, true), xlen = dv.getUint16(off + 28, true); const start = off + 30 + nlen + xlen; const data = u8.slice(start, start + csz); if (method === 0) return new TextDecoder().decode(data); if (method === 8 && typeof DecompressionStream !== 'undefined') { const ds = new DecompressionStream('deflate-raw'); return await new Response(new Blob([data]).stream().pipeThrough(ds)).text(); } off = start + csz; } throw new Error('Report ZIP could not be read in this browser'); }
  async function pullMicrosoft(n) {
    const C = cfg('microsoft'); if (!C.accountId) throw new Error('Microsoft Advertising: enter the account ID first.'); const a = await access('microsoft'); const R = range(n); const h = { Authorization: 'Bearer ' + a, DeveloperToken: C.developerToken || '', CustomerId: String(C.customerId || ''), CustomerAccountId: String(C.accountId || ''), 'Content-Type': 'application/json' }; const B = base('microsoft');
    const d = s => { const [y, m, dd] = s.split('-').map(Number); return { Day: dd, Month: m, Year: y }; };
    const req = { ReportRequest: { Type: 'CampaignPerformanceReportRequest', Format: 'Csv', ReportName: 'severance', ReturnOnlyCompleteData: false, Aggregation: 'Hourly', Columns: ['TimePeriod', 'CampaignName', 'Impressions', 'Clicks', 'Spend', 'Conversions'], Scope: { AccountIds: [+C.accountId] }, Time: { CustomDateRangeStart: d(R.since), CustomDateRangeEnd: d(R.until) } } };
    const sub = await J(`${B}/Reporting/v13/GenerateReport/Submit`, { method: 'POST', headers: h, body: JSON.stringify(req) }); const id = sub.ReportRequestId; let url = null;
    for (let i = 0; i < 20 && !url; i++) { await sleep(+C.pollMs || 3000); const p = await J(`${B}/Reporting/v13/GenerateReport/Poll`, { method: 'POST', headers: h, body: JSON.stringify({ ReportRequestId: id }) }); const st = p.ReportRequestStatus || {}; if (st.Status === 'Success') url = st.ReportDownloadUrl; if (st.Status === 'Error') throw new Error('Report failed'); }
    if (!url) throw new Error('Report not ready after one minute'); const buf = await (await F(url)).arrayBuffer(); const text = await inflateZipCsv(buf);
    const lines = text.split(/\r?\n/).filter(l => l && !l.startsWith('"Report') && !l.startsWith('Report')); const hdrI = lines.findIndex(l => /TimePeriod/.test(l)); if (hdrI < 0) throw new Error('Report has no TimePeriod header'); const H = lines[hdrI].split(',').map(x => x.replace(/"/g, '')); const ix = k => H.indexOf(k); const rows = [];
    lines.slice(hdrI + 1).forEach(l => { const c = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(x => x.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')); if (c.length < H.length || !c[ix('TimePeriod')]) return; const tp = c[ix('TimePeriod')]; const hr = /\d{1,2}$/.test(tp) && tp.length > 10 ? +tp.split(/[ |]/).pop() : null; rows.push(row({ src: 'microsoft', kind: hr == null ? 'ads' : 'hour', date: tp.slice(0, 10), hour: hr, campaign: c[ix('CampaignName')], imp: +c[ix('Impressions')] || 0, clicks: +c[ix('Clicks')] || 0, spend: +c[ix('Spend')] || 0, leads: +c[ix('Conversions')] || 0 })); });
    /* the hourly report is the only one requested: fold it into daily rows too so byLine and pacing (hour == null) see the spend */
    foldHours(rows, 'microsoft').forEach(o => rows.push(o));
    S.actuals.microsoft = { fetched: new Date().toISOString(), range: R, rows, notes: [], ver: 'v13' }; await save('actuals'); return S.actuals.microsoft;
  }
  function foldHours(rows, src, skip) { const day = {}; rows.filter(r => r.kind === 'hour').forEach(r => { const k = r.date + '|' + r.campaign + '|' + r.adset; if (skip && skip.has(r.date + '|' + r.campaign)) return; const o = day[k] = day[k] || row({ src: src || r.src, kind: 'ads', date: r.date, campaign: r.campaign, adset: r.adset, line: r.line }); o.imp += r.imp; o.clicks += r.clicks; o.spend += r.spend; o.leads += r.leads; o.calls += r.calls; o.msgs += r.msgs; o.conv += r.conv; }); return Object.values(day).map(o => Object.assign(o, { spend: +o.spend.toFixed(2) })); }
  /* ---------- LinkedIn ---------- */
  async function pullLinkedIn(n) {
    const C = cfg('linkedin'); if (!C.adAccountId) throw new Error('LinkedIn: enter the sponsored account ID first.'); const a = await access('linkedin'); const R = range(n); const h = { Authorization: 'Bearer ' + a, 'LinkedIn-Version': '202509', 'X-Restli-Protocol-Version': '2.0.0' }; const B = base('linkedin');
    const p = s => { const [y, m, d] = s.split('-').map(Number); return `(year:${y},month:${m},day:${d})`; };
    const j = await J(`${B}/rest/adAnalytics?q=analytics&pivot=CAMPAIGN&timeGranularity=DAILY&dateRange=(start:${p(R.since)},end:${p(R.until)})&accounts=List(urn%3Ali%3AsponsoredAccount%3A${C.adAccountId})&fields=impressions,clicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions,dateRange,pivotValues`, { headers: h });
    const rows = (j.elements || []).map(e => { const d = e.dateRange && e.dateRange.start; const camp = (e.pivotValues || [])[0] || 'LinkedIn'; return row({ src: 'linkedin', date: d ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}` : R.until, campaign: camp, imp: +e.impressions || 0, clicks: +e.clicks || 0, spend: +e.costInLocalCurrency || 0, leads: (+e.oneClickLeads || 0) + (+e.externalWebsiteConversions || 0), line: lineOf(camp) || 'high' }); });
    S.actuals.linkedin = { fetched: new Date().toISOString(), range: R, rows, notes: [], ver: '202509' };
    try { if (C.organizationId) { const f = await J(`${B}/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn%3Ali%3Aorganization%3A${C.organizationId}`, { headers: h }); const tot = sum((f.elements || []).flatMap(e => (e.followerCountsByAssociationType || []).map(x => (x.followerCounts || {}).organicFollowerCount || 0))); S.actuals.linkedinpage = { fetched: new Date().toISOString(), range: R, rows: [row({ src: 'linkedinpage', kind: 'social', date: R.until, campaign: 'followers', msgs: tot })] }; } } catch (e) { S.actuals.linkedin.notes.push('Page followers: ' + e.message); }
    await save('actuals'); return S.actuals.linkedin;
  }
  const PULLS = { google: pullGoogle, lsa: pullLsa, youtube: pullYouTube, meta: pullMeta, tiktok: pullTikTok, microsoft: pullMicrosoft, linkedin: pullLinkedIn };
  async function pull(p, n) { n = n || S.settings.range || 30; if (!PULLS[p]) throw new Error('Unknown provider'); return PULLS[p](n); }
  async function test(p) {
    const a = await access(p);
    if (p === 'google') { const v = await resolveVer('google', true); const j = await J(`${base('google')}/${v}/customers:listAccessibleCustomers`, { headers: gHeaders(a) }); return `Google Ads API ${v} (probe: ${cfg('google')._probe || VERS.google.probe.join(', ')}). Accessible customers: ${(j.resourceNames || []).map(x => x.split('/').pop()).join(', ') || 'none'}`; }
    if (p === 'lsa') { const C = cfg('lsa'); const mcc = String(C.managerCustomerId || '').replace(/\D/g, ''); if (!mcc) throw new Error('Enter the manager account ID first.'); const own = String(C.customerId || '').replace(/\D/g, ''); const accts = (await lsaSearch('accountReports', mcc, range(7), a)).filter(A => !own || String(A.accountId) === own); await setCfg('lsa', { _ver: 'v1' }); return `Local Services API v1: ${accts.length} account${accts.length === 1 ? '' : 's'} under manager ${mcc}: ${accts.map(A => `${A.businessName || '?'} (${A.accountId}, weekly budget ${A.averageWeeklyBudget != null ? A.averageWeeklyBudget : '?'} ${A.currencyCode || ''}, rating ${A.averageFiveStarRating != null ? A.averageFiveStarRating : '?'})`).join('; ') || 'none'}`; }
    if (p === 'youtube') { const C = cfg('youtube'); const db = C.apiBase ? base('youtube') : PROVIDERS.youtube.dataBase; const c = await J(`${db}/youtube/v3/channels?part=snippet,statistics&${C.channelId ? 'id=' + encodeURIComponent(C.channelId) : 'mine=true'}`, { headers: { Authorization: 'Bearer ' + a } }); const it = (c.items || [])[0]; await setCfg('youtube', { _ver: 'analytics v2, data v3' }); return it ? `YouTube Data v3, Analytics v2: channel ${(it.snippet || {}).title || ''} (${it.id}), ${(it.statistics || {}).subscriberCount || 0} subscribers, ${(it.statistics || {}).videoCount || 0} videos` : 'YouTube Data v3: no channel on this sign in'; }
    if (p === 'meta') { const v = await resolveVer('meta', true); const Gb = `${base('meta')}/${v}`; const j = await mj(`${Gb}/me?fields=id,name&access_token=${encodeURIComponent(a)}`); const ac = await mj(`${Gb}/me/adaccounts?fields=account_id,name,account_status&limit=50&access_token=${encodeURIComponent(a)}`).catch(() => ({ data: [] })); const t = tok('meta') || {}; return `Graph API ${v} (probe: ${cfg('meta')._probe || ''}). Connected as ${j.name}${t.long ? ' with a 60 day token' : ''}; ad accounts: ${(ac.data || []).map(x => `${x.name} (act_${x.account_id})`).join(', ') || 'none visible'}`; }
    if (p === 'tiktok') { const C = cfg('tiktok'); const j = await tkGet('/oauth2/advertiser/get/', { app_id: C.appId, secret: C.secret }); const list = ((j.data || {}).list || []); const patch = { _ver: 'v1.3' }; if (!C.advertiserId && list.length) patch.advertiserId = String(list[0].advertiser_id); await setCfg('tiktok', patch); return `TikTok Business API v1.3. Advertisers: ${list.map(x => `${x.advertiser_name || '?'} (${x.advertiser_id})`).join(', ') || 'none'}${patch.advertiserId ? '; stored ' + patch.advertiserId + ' as the advertiser ID' : ''}`; }
    if (p === 'microsoft') { const C = cfg('microsoft'); const j = await J(`${String(C.ccBase || PROVIDERS.microsoft.ccBase).replace(/\/+$/, '')}/CustomerManagement/v13/User/Query`, { method: 'POST', headers: { Authorization: 'Bearer ' + a, DeveloperToken: C.developerToken || '', 'Content-Type': 'application/json' }, body: JSON.stringify({ UserId: null }) }); await setCfg('microsoft', { _ver: 'v13' }); return `Microsoft Advertising v13: connected as ${(j.User || {}).UserName || 'user'}`; }
    if (p === 'linkedin') { const j = await J(`${base('linkedin')}/rest/adAccounts?q=search`, { headers: { Authorization: 'Bearer ' + a, 'LinkedIn-Version': '202509', 'X-Restli-Protocol-Version': '2.0.0' } }); await setCfg('linkedin', { _ver: '202509' }); return `LinkedIn 202509. Ad accounts: ${(j.elements || []).map(e => e.name + ' (' + e.id + ')').join(', ') || 'none'}`; }
    return 'ok';
  }
  /* ---------- file imports ---------- */
  function csvRows(text) {
    const s = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const first = (s.split('\n').find(l => l.trim() && !/^\s*#/.test(l)) || ''); const d = first.split('\t').length > first.split(',').length ? '\t' : ',';
    const rows = []; let r = [], c = '', q = false;
    for (let i = 0; i < s.length; i++) { const ch = s[i]; if (q) { if (ch === '"') { if (s[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; } else if (ch === '"') q = true; else if (ch === d) { r.push(c); c = ''; } else if (ch === '\n') { r.push(c); rows.push(r); r = []; c = ''; } else c += ch; }
    if (c.length || r.length) { r.push(c); rows.push(r); } return rows;
  }
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[$,%\s]/g, '').replace(/^--$/, '')); return isN(n) ? n : 0; };
  /* a date or timestamp cell → {date: 'YYYY-MM-DD', hour}; 'Sep 20, 2026 2:05 PM', '09/20/2026 14:05', '2026-09-20T14:05:00-05:00' (wall time as written) */
  function tparts(v) {
    const s = String(v || '').trim(); let m, date = '';
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) date = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) date = `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    else { const t = Date.parse(s.replace(/\s+at\s+/i, ' ').replace(/(\d)(am|pm)\b/i, '$1 $2')); if (isN(t)) { const d = new Date(t); date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; } }
    let hour = null; const hm = s.slice(6).match(/(?:^|[T\s])(\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?\s*(am|pm)?/i);
    if (date && hm) { let h = +hm[1]; const ap = (hm[3] || '').toLowerCase(); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; if (h >= 0 && h < 24) hour = h; }
    return { date, hour };
  }
  const truthy = v => /^(yes|y|true|1|x|qualified|good|good lead|converted|won|retained|hired|charged)$/i.test(String(v || '').trim());
  const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
  const INTAKE_MAP = { date: ['created', 'created at', 'created date', 'date created', 'created on', 'lead created', 'inquiry date', 'intake date', 'date'], hired: ['hired date', 'retained date', 'date hired', 'converted at', 'converted date', 'signed date'], campaign: ['utm campaign', 'campaign', 'marketing campaign'], source: ['referral source', 'lead source', 'marketing source', 'source', 'how did you hear about us', 'how did you hear', 'utm source'], practice: ['practice area', 'matter type', 'case type', 'area of law'], status: ['status', 'matter status', 'lead status', 'outcome'], stage: ['stage', 'pipeline stage', 'matter stage', 'lead stage', 'sub status'], value: ['value', 'matter value', 'estimated value', 'case value', 'potential value', 'fee', 'retainer', 'retainer amount', 'amount', 'revenue'], zip: ['zip', 'zip code', 'postal code', 'zipcode'], county: ['county'], city: ['city'] };
  const IMPORTERS = [
    { id: 'google-ui', name: 'Google Ads report (UI export)', src: 'google', detect: H => H.includes('campaign') && (H.includes('cost') || H.includes('cost (usd)')) && (H.includes('day') || H.includes('week') || H.includes('month')), map: { date: ['day', 'week', 'month'], hour: ['hour of day', 'hour'], campaign: ['campaign'], adset: ['ad group'], zip: ['postal code', 'zip code', 'user location', 'matched location'], county: ['county'], imp: ['impr.', 'impressions'], clicks: ['clicks'], spend: ['cost', 'cost (usd)'], leads: ['conversions', 'conv.'], calls: ['phone calls', 'calls'] } },
    { id: 'meta-ui', name: 'Meta Ads Manager export', src: 'meta', detect: H => H.some(h => h.startsWith('campaign name')) && H.some(h => h.startsWith('amount spent')), map: { date: ['day', 'reporting starts'], hour: ['time of day (ad account time zone)', 'time of day (viewer time zone)'], campaign: ['campaign name'], adset: ['ad set name'], region: ['region'], zip: ['zip code', 'postal code'], imp: ['impressions'], clicks: ['link clicks', 'clicks (all)'], spend: ['amount spent (usd)', 'amount spent'], leads: ['leads', 'results', 'on-facebook leads', 'website leads'], calls: ['calls', 'call confirmation clicks'], msgs: ['messaging conversations started'] } },
    /* TikTok Ads Manager, Reporting, custom report, Run and Export (CSV): Campaign name, Ad group name, Date (or By day), Cost, Impressions, Clicks (destination), CTR (destination), CPC (destination), CPM, Conversions, CPA, CVR (https://ads.tiktok.com/help/article/create-manage-reports, https://ads.tiktok.com/help/article/basic-data) */
    { id: 'tiktok-ui', name: 'TikTok Ads Manager export', src: 'tiktok', detect: H => H.some(h => h.startsWith('campaign name')) && (H.includes('cost') || H.includes('total cost') || H.includes('spend')) && !H.some(h => h.startsWith('amount spent')), map: { date: ['date', 'day', 'by day', 'time', 'stat time'], hour: ['hour', 'by hour', 'time of day'], campaign: ['campaign name'], adset: ['ad group name'], imp: ['impressions'], clicks: ['clicks (destination)', 'clicks', 'clicks (all)'], spend: ['cost', 'total cost', 'spend'], leads: ['conversions', 'results', 'conversion'] } },
    { id: 'microsoft-ui', name: 'Microsoft Advertising report', src: 'microsoft', detect: H => H.includes('campaignname') || (H.includes('campaign name') && H.includes('spend')), map: { date: ['timeperiod', 'time period', 'gregorian date'], hour: ['hourofday', 'hour of day'], campaign: ['campaignname', 'campaign name'], adset: ['adgroupname', 'ad group name', 'ad group'], imp: ['impressions'], clicks: ['clicks'], spend: ['spend'], leads: ['conversions'] } },
    { id: 'lsa', name: 'Local Services Ads leads export', src: 'lsa', lead: true, stamp: true, detect: H => H.some(h => h.includes('lead')) && (H.includes('job type') || H.includes('lead type')), map: { date: ['lead creation time', 'lead received', 'created', 'date', 'time'], campaign: ['job type', 'category', 'lead category'], type: ['lead type', 'type'], note: ['lead status', 'status'], charged: ['charged', 'lead charged', 'charge status'], price: ['lead price', 'price', 'cost'], zip: ['postal code', 'zip code', 'zip'], city: ['city', 'location'] } },
    /* YouTube Studio, Analytics, Advanced mode, Export current view: Table data.csv (Content, Video title, Video publish time, Views, Watch time (hours), Subscribers, Impressions, Impressions click-through rate (%)) and Chart data.csv (Date, Views, ...) (https://support.google.com/youtube/answer/9717005) */
    { id: 'youtube-studio', name: 'YouTube Studio export (Content or Chart data)', src: 'youtube', kind: 'social', today: true, detect: H => H.includes('video title') || (H.includes('watch time (hours)') && H.includes('views')) || (H.includes('date') && H.includes('views') && !H.includes('campaign') && !H.includes('cost')), map: { date: ['date', 'video publish time'], campaign: ['video title', 'content'], imp: ['views'], conv: ['watch time (hours)', 'watch time (minutes)'], msgs: ['subscribers', 'subscribers gained'], clicks: ['impressions click-through rate (%)'] } },
    /* CallRail, Reports, Call Log, Export (CSV): Start Time, Source, Campaign, Keywords, Tracking Number, Customer City and State, Duration, Lead Status, Value; caller names and numbers are never read */
    { id: 'callrail', name: 'CallRail call log export', src: 'callrail', lead: true, call: true, stamp: true, detect: H => (H.includes('start time') || H.includes('call start')) && (H.some(h => h === 'source' || h === 'source name') || H.includes('tracking number') || H.includes('tracking source')), map: { date: ['start time', 'call start', 'date'], campaign: ['campaign', 'source', 'source name', 'tracking source'], label: ['tracking number name', 'tracking label', 'number name'], adset: ['keywords', 'keyword', 'ad group'], chan: ['source', 'source name', 'tracking source', 'medium', 'campaign'], city: ['customer city', 'city'], county: ['county'], zip: ['customer zip', 'zip', 'postal code'], qualified: ['lead status', 'qualified', 'good lead'], value: ['value', 'lead value', 'revenue'], note: ['call status', 'lead status', 'tags'], duration: ['duration (seconds)', 'duration', 'call duration'] } },
    /* CallTrackingMetrics, Calls, Export (CSV): Called At, Source, Tracking Label, Tracking Number, Receiving Number, City, State, Postal Code, Duration, Talk Time, Status, Tags, Sale or Conversion fields */
    { id: 'ctm', name: 'CallTrackingMetrics call log export', src: 'ctm', lead: true, call: true, stamp: true, detect: H => H.includes('called at') || H.includes('tracking label') || (H.includes('receiving number') && H.some(h => h.includes('source'))), map: { date: ['called at', 'call date', 'start time', 'date'], campaign: ['campaign', 'tracking source', 'source'], label: ['tracking label', 'tracking number name'], adset: ['keyword', 'keywords', 'search', 'ad group'], chan: ['tracking source', 'source', 'tracking label', 'campaign'], city: ['city'], county: ['county'], zip: ['postal code', 'zip', 'zip code'], qualified: ['qualified', 'converted', 'conversion', 'sale status', 'lead status'], value: ['sale value', 'value', 'revenue', 'sale amount'], note: ['status', 'call status', 'tags'], duration: ['talk time', 'duration'] } },
    /* Clio Grow, Inbox or Matters, Export (CSV): created date, practice area, referral or lead source, status (Hired, Not hired, Pending, Consult scheduled), value; names, emails and phone numbers are never read */
    { id: 'clio-grow', name: 'Clio Grow leads or matters export', src: 'clio', intake: true, detect: H => H.some(h => /practice area|matter type|case type/.test(h)) && H.some(h => /referral source|lead source|^source$/.test(h)) && !H.some(h => /^stage$|pipeline stage|matter stage|lead stage|sub status/.test(h)), map: INTAKE_MAP },
    /* Lawmatics, Matters or Prospects, Export (CSV): created date, practice area or matter type, source and campaign, stage and status, estimated value */
    { id: 'lawmatics', name: 'Lawmatics matters or prospects export', src: 'lawmatics', intake: true, detect: H => H.some(h => /practice area|matter type|case type/.test(h)) && H.some(h => /^stage$|pipeline stage|matter stage|lead stage|sub status/.test(h)), map: INTAKE_MAP },
    { id: 'generic', name: 'Generic sheet (date, campaign, spend, leads, retained)', src: 'other', generic: true, detect: H => (H.includes('date') || H.includes('day')) && (H.some(h => /^(spend|cost|leads|retained|conversions)$/.test(h))), map: { date: ['date', 'day'], hour: ['hour'], campaign: ['campaign', 'name', 'source', 'platform'], adset: ['ad group', 'ad set', 'adset'], practice: ['practice area', 'line', 'service line'], zip: ['zip', 'zip code', 'postal code'], county: ['county'], city: ['city'], imp: ['impressions', 'impr'], clicks: ['clicks'], spend: ['spend', 'cost'], leads: ['leads', 'conversions', 'results', 'inquiries'], calls: ['calls'], retained: ['retained', 'hired', 'signed', 'clients'], value: ['value', 'revenue', 'fees'] } },
  ];
  const HDR_RE = /campaign|date|day|spend|cost|lead|video|views|called at|start time|practice area|matter type|status|source|created/i;
  function importCSV(text, forceId, srcLabel) {
    const rows = csvRows(text).filter(r => r.length > 1 && !/^\s*#/.test(r[0] || '')); if (!rows.length) return { rows: [], note: 'No rows' };
    let hi = rows.findIndex(r => r.filter(x => String(x).trim()).length >= 3 && r.some(c => HDR_RE.test(c))); if (hi < 0) hi = 0;
    const H = rows[hi].map(h => String(h).trim().toLowerCase().replace(/\s+/g, ' '));
    const imp = IMPORTERS.find(i => i.id === forceId) || IMPORTERS.find(i => i.detect(H)); if (!imp) return { rows: [], note: 'Columns not recognized; pick the format or start from the template' };
    /* every column a field may come from, best first (exact header names, then headers that start with one); a cell left empty falls through to the next */
    const cols = k => { const cands = imp.map[k] || []; const out = []; cands.forEach(c => { const i = H.indexOf(c); if (i >= 0 && !out.includes(i)) out.push(i); }); cands.forEach(c => H.forEach((h, i) => { if (h.startsWith(c) && !out.includes(i)) out.push(i); })); return out; };
    const ix = {}, ixs = {}; Object.keys(imp.map).forEach(k => { ixs[k] = cols(k); ix[k] = ixs[k].length ? ixs[k][0] : -1; });
    const NUMK = ['imp', 'clicks', 'spend', 'leads', 'calls', 'msgs', 'conv', 'retained', 'value', 'price', 'duration', 'hour', 'qualified'];   /* a blank count is a zero, not a reason to read another column */
    const g = (r, k) => { for (const i of (NUMK.includes(k) ? (ix[k] >= 0 ? [ix[k]] : []) : ixs[k] || [])) { const v = String(r[i] == null ? '' : r[i]).trim(); if (v !== '') return v; } return ''; };
    const src = String(srcLabel || '').trim().toLowerCase().replace(/[^a-z0-9 ]+/g, '').trim() || imp.src;
    const key = 'import:' + imp.src; const prev = S.actuals[key] || { rows: [] }; const seen = new Set(prev.rows.map(r => r.h).filter(Boolean));
    const out = []; let dup = 0, skipped = 0; const today = dstr(new Date());
    rows.slice(hi + 1).forEach(r => {
      if (r.filter(x => String(x).trim()).length < 2 || /^total/i.test(String(r[0]).trim()) || (ix.campaign >= 0 && /^total/i.test(String(r[ix.campaign] || '').trim()))) return;
      const tp = tparts(g(r, 'date')); const date = tp.date || (imp.today ? today : ''); if (!date) { skipped++; return; }
      const hourRaw = g(r, 'hour'); const hp = parseInt(hourRaw, 10); const hour = hourRaw !== '' && isN(hp) && hp >= 0 && hp < 24 ? hp : imp.stamp ? tp.hour : null;
      const geo = { zip: g(r, 'zip'), county: g(r, 'county'), city: g(r, 'city'), region: g(r, 'region') };
      let o;
      if (imp.intake) {
        const stage = (g(r, 'hired') && tparts(g(r, 'hired')).date) ? 'retained' : stageOf(g(r, 'status'), g(r, 'stage')); const practice = g(r, 'practice'); const source = g(r, 'source'), camp = g(r, 'campaign');
        const ch = chanOf(source); o = row({ src, kind: 'intake', date, hour, campaign: [source, camp].filter(Boolean).join(' · ') || imp.name, adset: practice, geo, leads: 1, retained: stage === 'retained' ? 1 : 0, consult: stage === 'consult' || stage === 'retained' ? 1 : 0, stage, value: num(g(r, 'value')), chan: ch === 'unknown' || ch === 'other' ? (camp ? chanOf(camp) : ch) : ch, line: lineOf(practice) || lineOf(camp, source), note: [g(r, 'status'), g(r, 'stage')].filter(Boolean).join(' · ') });
      } else if (imp.lead) {
        const type = g(r, 'type').toLowerCase(); const isCall = imp.call || /phone|call/.test(type); const isMsg = !isCall && /message/.test(type); const charged = /yes|true|^charged/i.test(g(r, 'charged')); const dur = g(r, 'duration');
        const camp0 = g(r, 'campaign'), label = g(r, 'label'); const camp = [camp0, label && label !== camp0 ? label : ''].filter(Boolean).join(' · ') || imp.name;
        o = row({ src, kind: 'lead', date, hour, campaign: camp, adset: g(r, 'adset'), geo, leads: 1, calls: isCall ? 1 : 0, msgs: isMsg ? 1 : 0, conv: imp.call ? (truthy(g(r, 'qualified')) ? 1 : 0) : (charged ? 1 : 0), spend: imp.id === 'lsa' && charged ? num(g(r, 'price')) : 0, value: num(g(r, 'value')), note: [g(r, 'note'), dur ? 'duration ' + dur : ''].filter(Boolean).join(' · '), line: imp.id === 'lsa' ? (lineOf(camp) || 'div_k') : lineOf(g(r, 'adset'), label, camp0) });
        if (imp.call) { o.trk = 1; o.chan = chanOf(g(r, 'chan') || camp0); }
      } else {
        const zipHit = String(geo.zip || '').match(ZIP_RE); const retainedRaw = g(r, 'retained');
        const kind = imp.kind || (imp.generic ? (hour == null ? 'ads' : 'hour') : (zipHit || geo.region ? 'geo' : hour == null ? 'ads' : 'hour'));
        o = row({ src, kind, date, hour: kind === 'ads' || kind === 'geo' ? null : hour, campaign: g(r, 'campaign') || imp.name, adset: g(r, 'adset'), geo, imp: num(g(r, 'imp')), clicks: num(g(r, 'clicks')), spend: num(g(r, 'spend')), leads: num(g(r, 'leads')), calls: num(g(r, 'calls')), msgs: num(g(r, 'msgs')), conv: num(g(r, 'conv')), retained: retainedRaw === '' ? 0 : (isN(parseFloat(retainedRaw)) ? num(retainedRaw) : truthy(retainedRaw) ? 1 : 0), value: num(g(r, 'value')), line: imp.generic ? (lineOf(g(r, 'practice')) || lineOf(g(r, 'adset'), g(r, 'campaign'))) : '' });
        if (imp.generic && ix.retained >= 0) o.hasRet = 1;
      }
      o.h = fnv(imp.id + '\u0001' + src + '\u0001' + r.join('\u0001')); if (seen.has(o.h)) { dup++; return; } seen.add(o.h); out.push(o);
    });
    /* an hourly only export (hour of day report, generic hourly sheet) also becomes daily rows, unless daily rows for the same day and campaign are already held */
    if (!imp.lead && !imp.intake && out.some(r => r.kind === 'hour') && !out.some(r => r.kind === 'ads')) { const have = new Set(prev.rows.filter(r => r.kind === 'ads').map(r => r.date + '|' + r.campaign)); foldHours(out, src, have).forEach(o => { o.h = fnv('fold' + o.date + o.campaign + o.adset + o.spend); if (!seen.has(o.h)) { seen.add(o.h); out.push(o); } }); }
    const all = prev.rows.concat(out).slice(-40000);
    S.actuals[key] = { fetched: new Date().toISOString(), range: { since: all.reduce((m, r) => !m || r.date < m ? r.date : m, ''), until: all.reduce((m, r) => !m || r.date > m ? r.date : m, '') }, rows: all, notes: [], importer: imp.id };
    S.imports.push({ at: new Date().toISOString(), importer: imp.id, src, n: out.length, dup, skipped }); S.imports = S.imports.slice(-200); save('actuals');
    const ret = out.filter(r => r.kind === 'intake').length ? `, ${out.filter(r => r.retained).length} retained` : '';
    return { rows: out, dup, skipped, note: `${out.length} rows as ${imp.name}${ret}${dup ? `, ${dup} already held and skipped` : ''}${skipped ? `, ${skipped} without a date skipped` : ''}`, importer: imp };
  }
  function templateCSV() { return toCSV(['date', 'hour', 'campaign', 'ad group', 'practice area', 'zip', 'county', 'impressions', 'clicks', 'spend', 'leads', 'calls', 'retained', 'value'], [['2026-09-21', '', 'SEV_DIV_K_HARRIS_EN', 'Houston divorce with children', '', '77005', 'Harris', 2400, 61, 512.4, 5, 2, 1, 9500], ['2026-09-21', '', 'Mailer, Fort Bend', '', 'Modification', '77479', 'Fort Bend', 0, 0, 380, 3, 1, 0, 0]], 'Generic import template: one row per day (or per hour with the hour column) per campaign. ZIP, county, practice area, retained and value are optional.\nService lines are read from the practice area, then the ad group, then the campaign: a line key token (SEV_DIV_K_, _MOD_, _PO_) or a line name maps directly, keywords do the rest.'); }
  /* ---------- analytics over actuals ---------- */
  /* The Google pull tags video and Local Services campaigns by channel type; once the YouTube or LSA provider has pulled its own rows, the Google copies are dropped here so nothing counts twice. */
  function rowsAll(kind) { const yt = !!(S.actuals.youtube && (S.actuals.youtube.rows || []).some(r => r.kind === 'ads' || r.kind === 'hour')); const lsa = !!(S.actuals.lsa && (S.actuals.lsa.rows || []).length); return Object.entries(S.actuals).flatMap(([k, a]) => (a.rows || []).filter(r => k !== 'google' || !((yt && r.src === 'youtube') || (lsa && r.src === 'lsa'))).map(r => Object.assign({ _src: k }, r))).filter(r => !kind || (Array.isArray(kind) ? kind.includes(r.kind) : r.kind === kind)); }
  const paidRows = () => rowsAll(['ads']);
  const sinceOf = days => dstr(daysAgo(days || S.settings.range || 30));
  const blank = () => ({ spend: 0, imp: 0, clicks: 0, leads: 0, calls: 0, intake: 0, consults: 0, retained: 0, value: 0, tracked: 0 });
  function finish(o) { const L = Math.max(o.leads + o.calls, o.intake); o.leadsBest = L; o.cpl = L && o.spend ? o.spend / L : null; o.cpc = o.clicks ? o.spend / o.clicks : null; o.ctr = o.imp ? 100 * o.clicks / o.imp : null; o.cvr = o.clicks ? 100 * (o.leads + o.calls) / o.clicks : null; o.retainRate = o.intake ? 100 * o.retained / o.intake : (o.leads + o.calls) && o.retained ? 100 * o.retained / (o.leads + o.calls) : null; o.cpr = o.retained && o.spend ? o.spend / o.retained : null; o.roas = o.spend ? o.value / o.spend : null; return o; }
  function byLine(days) {
    const since = sinceOf(days); const out = {};
    const get = k => out[k] = out[k] || Object.assign({ line: k, byPlat: {} }, blank());
    const plat = (o, s) => o.byPlat[s] = o.byPlat[s] || blank();
    paidRows().filter(r => r.date >= since && r.hour == null).forEach(r => { const o = get(r.line || 'unmapped'); const p = plat(o, r.src); [o, p].forEach(x => { x.spend += r.spend; x.imp += r.imp; x.clicks += r.clicks; x.leads += r.leads; x.calls += r.calls; x.retained += r.retained || 0; x.value += r.retained ? (r.value || 0) : 0; }); });
    rowsAll('lead').filter(r => r.date >= since).forEach(r => { const o = get(r.line || 'unmapped'); const asLead = r.calls ? 0 : 1, asCall = r.calls ? 1 : 0; const p = plat(o, r.src); [o, p].forEach(x => { x.leads += asLead; x.calls += asCall; if (r.trk) x.tracked++; }); });
    rowsAll('intake').filter(r => r.date >= since).forEach(r => { const o = get(r.line || 'unmapped'); const p = plat(o, r.chan || r.src); [o, p].forEach(x => { x.intake++; x.consults += r.consult || 0; x.retained += r.retained ? 1 : 0; x.value += r.retained ? (r.value || 0) : 0; }); });
    Object.values(out).forEach(o => { finish(o); Object.values(o.byPlat).forEach(finish); }); return Object.values(out).sort((a, b) => b.spend - a.spend || b.intake - a.intake);
  }
  /* by source: ad platform spend and conversions by src, tracked calls and intake by the channel their source maps to */
  function bySource(days) {
    const since = sinceOf(days); const out = {}; const get = k => out[k] = out[k] || Object.assign({ src: k }, blank());
    paidRows().filter(r => r.date >= since && r.hour == null).forEach(r => { const o = get(r.src); o.spend += r.spend; o.imp += r.imp; o.clicks += r.clicks; o.leads += r.leads; o.calls += r.calls; o.retained += r.retained || 0; o.value += r.retained ? (r.value || 0) : 0; });
    rowsAll('lead').filter(r => r.date >= since).forEach(r => { if (r.trk) { const o = get(r.chan || 'unknown'); o.tracked++; } else { const o = get(r.src); if (r.calls) o.calls++; else o.leads++; } });
    rowsAll('intake').filter(r => r.date >= since).forEach(r => { const o = get(r.chan || 'unknown'); o.intake++; o.consults += r.consult || 0; o.retained += r.retained ? 1 : 0; o.value += r.retained ? (r.value || 0) : 0; });
    return Object.values(out).map(o => { finish(o); const L = Math.max(o.leads + o.calls, o.tracked, o.intake); o.leadsBest = L; o.cpl = L && o.spend ? o.spend / L : null; return o; }).sort((a, b) => b.spend - a.spend || b.intake - a.intake);
  }
  function byHour(days) { const since = sinceOf(days); const H = Array.from({ length: 24 }, (_, h) => ({ h, spend: 0, clicks: 0, leads: 0, calls: 0, n: 0 })); rowsAll(['ads', 'hour', 'lead']).filter(r => r.hour != null && r.date >= since).forEach(r => { const o = H[clamp(Math.floor(r.hour), 0, 23)]; o.spend += r.spend; o.clicks += r.clicks; o.leads += r.leads; o.calls += r.calls; o.n++; }); const tot = sum(H.map(x => x.spend)) || 1, totL = sum(H.map(x => x.leads + x.calls)) || 1; H.forEach(x => { x.spendSh = 100 * x.spend / tot; x.leadSh = 100 * (x.leads + x.calls) / totL; x.cpl = (x.leads + x.calls) && x.spend ? x.spend / (x.leads + x.calls) : null; }); return H; }
  /* the observed hours as a 7 day by 6 block bid adjustment grid (%, rounded to 5) for the Live Desk timing when settings().useObserved is on */
  function observedGrid() { const H = byHour(90); if (!H.some(x => x.n)) return null; const blocks = [[0, 6], [6, 9], [9, 12], [12, 17], [17, 21], [21, 24]]; const mean = sum(H.map(x => x.leadSh)) / 24; const g = blocks.map(([a, b]) => { const sh = sum(H.slice(a, b).map(x => x.leadSh)) / (b - a); return clamp(Math.round(((sh / (mean || 1)) - 1) * 100 / 5) * 5, -50, 60); }); return [0, 1, 2, 3, 4, 5, 6].map(() => g.slice()); }
  function byZip(days) { const since = sinceOf(days || 90); const out = {}; rowsAll(['geo', 'lead', 'intake', 'ads']).filter(r => r.geo && r.geo.zip && r.date >= since).forEach(r => { const o = out[r.geo.zip] = out[r.geo.zip] || { zip: r.geo.zip, county: r.geo.county || '', cname: r.geo.cname || '', spend: 0, clicks: 0, leads: 0, imp: 0, intake: 0, retained: 0, value: 0 }; o.spend += r.spend; o.clicks += r.clicks; o.imp += r.imp; if (r.kind === 'intake') { o.intake++; o.retained += r.retained ? 1 : 0; o.value += r.retained ? (r.value || 0) : 0; } else { o.leads += r.kind === 'lead' ? 1 : r.leads + r.calls; o.retained += r.retained || 0; } }); Object.values(out).forEach(o => { const L = Math.max(o.leads, o.intake); o.cpl = L && o.spend ? o.spend / L : null; o.z = typeof ZI !== 'undefined' ? ZI[o.zip] || null : null; }); return Object.values(out).sort((a, b) => b.spend - a.spend || b.leads - a.leads); }
  function byCounty(days) { const since = sinceOf(days || 90); const out = {}; rowsAll(['geo', 'lead', 'intake', 'ads']).filter(r => r.geo && r.geo.county && r.date >= since).forEach(r => { const o = out[r.geo.county] = out[r.geo.county] || { county: r.geo.county, cname: r.geo.cname || r.geo.county, spend: 0, clicks: 0, leads: 0, intake: 0, retained: 0, value: 0, zips: new Set() }; o.spend += r.spend; o.clicks += r.clicks; if (r.geo.zip) o.zips.add(r.geo.zip); if (r.kind === 'intake') { o.intake++; o.retained += r.retained ? 1 : 0; o.value += r.retained ? (r.value || 0) : 0; } else { o.leads += r.kind === 'lead' ? 1 : r.leads + r.calls; o.retained += r.retained || 0; } }); return Object.values(out).map(o => { const L = Math.max(o.leads, o.intake); return Object.assign(o, { zips: o.zips.size, cpl: L && o.spend ? o.spend / L : null, cpr: o.retained && o.spend ? o.spend / o.retained : null, c: typeof CI !== 'undefined' ? CI[o.county] || null : null }); }).sort((a, b) => b.spend - a.spend || b.leads - a.leads); }
  /* the Campaign Desk plan: the last BUS 'plan' payload (module 10 emits {budget, cpc, cvr, retain, lines:[{key, budget, cpc, cvr, retain}]}),
     else the desk's saved settings (sev.desk: budget, asm.google.{cost, cvr, ret}), else the desk's Google search defaults (DESKX.ASM0.google) */
  function deskPlan() {
    const p = lastPlan || {}; let d = {}; try { d = store.get('sev.desk', {}) || {}; } catch (e) { d = {}; }
    const dflt = (typeof DESKX !== 'undefined' && DESKX && DESKX.ASM0 && DESKX.ASM0.google) || null; const asm = (d.asm && d.asm.google) || dflt || {};
    const val = v => v !== '' && v != null && isN(+v) ? +v : null; const pick = (k, a) => val(p[k]) != null ? val(p[k]) : val(d[k]) != null ? val(d[k]) : a ? val(asm[a]) : null;
    const lines = {}; const pl = p.lines || p.rows || null; if (pl && typeof pl === 'object') (Array.isArray(pl) ? pl : Object.entries(pl).map(([k, v]) => Object.assign({ line: k }, v))).forEach(x => { const k = x.line || x.key; const b = +(x.budget != null ? x.budget : x.budget_month); if (k && isN(b)) lines[k] = b; });
    return { budget: pick('budget'), cpc: pick('cpc', 'cost'), cvr: pick('cvr', 'cvr'), retain: pick('retain', 'ret'), lines, from: lastPlan ? 'the Campaign Desk' : Object.keys(d).length ? 'the Campaign Desk settings saved in this browser' : dflt ? 'the Campaign Desk defaults' : '' };
  }
  const planBudget = () => (isN(+S.settings.plan) && +S.settings.plan > 0) ? +S.settings.plan : deskPlan().budget;
  function pacing(planB) {
    const plan = planB != null ? planB : planBudget(); const now = new Date(); const m0 = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); const day = now.getDate();
    const rows = paidRows().filter(r => r.date >= m0 && r.hour == null); const spend = sum(rows.map(r => r.spend)); const bySrc = {}, byL = {}; rows.forEach(r => { bySrc[r.src] = (bySrc[r.src] || 0) + r.spend; const k = r.line || 'unmapped'; byL[k] = (byL[k] || 0) + r.spend; }); const days = [...new Set(rows.map(r => r.date))].length;
    return { spend, bySrc, byLine: byL, linePlan: deskPlan().lines, days, day, dim, rate: days ? spend / days : 0, projected: days ? spend / days * dim : 0, plan: plan || null, onPace: plan ? spend / (plan * day / dim) : null };
  }
  function social(days) { const since = dstr(daysAgo(days || 90)); const out = {}; rowsAll('social').filter(r => r.date >= since).forEach(r => { (out[r.src] = out[r.src] || []).push(r); }); return out; }
  /* ---------- feedback to the Campaign Desk ----------
     rates(line, days=90): observed figures for one LINE_META line (or every line when line is empty or 'all'). Each figure is null below its threshold:
       cpc     $ per click on Google and Microsoft search rows (50 clicks)
       cvr     % of those clicks that became a lead or call (50 clicks and 3 leads)
       retain  % of intake inquiries retained (10 decided inquiries; open inquiries younger than 14 days are left out), else from generic rows that carry retained counts
       n       leads observed in the window (the larger of platform conversions and intake records); since, until: the dates the figures cover */
  const MIN = { clicks: 50, leads: 3, intake: 10, youngDays: 14 };
  function rates(line, days) {
    days = days || 90; const since = sinceOf(days); const all = !line || line === 'all'; const on = r => all || r.line === line;
    const paid = paidRows().filter(r => r.date >= since && r.hour == null && on(r)); const search = paid.filter(r => r.src === 'google' || r.src === 'microsoft');
    const sS = sum(search.map(r => r.spend)), cS = sum(search.map(r => r.clicks)), lS = sum(search.map(r => r.leads + r.calls));
    const young = dstr(daysAgo(MIN.youngDays)); const intake = rowsAll('intake').filter(r => r.date >= since && on(r)); const decided = intake.filter(r => r.stage !== 'open' || r.date < young); const ret = decided.filter(r => r.retained).length;
    const gen = paid.filter(r => r.hasRet); const gRet = sum(gen.map(r => r.retained)), gL = sum(gen.map(r => r.leads + r.calls));
    const leadRows = rowsAll('lead').filter(r => r.date >= since && on(r)); const platLeads = sum(paid.map(r => r.leads + r.calls)) + leadRows.length;
    const spend = sum(paid.map(r => r.spend)); const retained = ret + gRet; const n = Math.max(platLeads, intake.length);
    const dates = paid.concat(intake, leadRows).map(r => r.date).filter(Boolean).sort();
    const retain = decided.length >= MIN.intake ? 100 * ret / decided.length : gL >= MIN.intake ? 100 * gRet / gL : null;
    return { line: all ? 'all' : line, days, since: dates[0] || since, until: dates[dates.length - 1] || dstr(new Date()), cpc: cS >= MIN.clicks && sS > 0 ? sS / cS : null, cvr: cS >= MIN.clicks && lS >= MIN.leads ? 100 * lS / cS : null, retain, n: Math.round(n), clicks: cS, leads: Math.round(lS), intake: decided.length, retained, spend, cpl: n && spend ? spend / n : null, cpr: retained && spend ? spend / retained : null, value: sum(intake.filter(r => r.retained).map(r => r.value || 0)) + sum(gen.map(r => r.value || 0)) };
  }
  /* Apply: the observed rates (above their thresholds) become the corrections the Campaign Desk reads through ACCT.applied(); Revert drops them */
  function applyToModels() {
    const keys = (LM() ? Object.keys(LM()) : LKEYS); const allR = rates('all'); const patch = { lines: {} }; ['cpc', 'cvr', 'retain'].forEach(k => { if (allR[k] != null) patch[k] = +allR[k].toFixed(k === 'cpc' ? 2 : 1); });
    keys.forEach(k => { const r = rates(k); const L = {}; ['cpc', 'cvr', 'retain'].forEach(f => { if (r[f] != null) L[f] = +r[f].toFixed(f === 'cpc' ? 2 : 1); }); if (Object.keys(L).length) patch.lines[k] = Object.assign(L, { n: r.n, since: r.since }); });
    S.settings.applied = { at: new Date().toISOString(), prev: deskPlan(), patch, since: allR.since, until: allR.until }; save('settings'); return patch;
  }
  function revertModels() { if (!S.settings.applied) return false; S.settings.applied = null; save('settings'); return true; }
  const applied = () => S.settings.applied ? S.settings.applied.patch : null;
  async function clearAll(what) { if (what === 'tokens' || !what) S.tokens = {}; if (what === 'actuals' || !what) { S.actuals = {}; S.imports = []; S.settings.applied = null; } if (what === 'cfg') S.cfg = {}; await save(what || 'all'); }
  function status(p) { const P = PROVIDERS[p]; const t = tok(p), C = cfg(p); const req = P.fields.filter(f => !(f[2] && f[2].optional)).map(f => f[0]); const configured = P.tokenOf ? req.every(k => C[k]) : P.fields.slice(0, 1).every(([k]) => C[k]); if (!configured && (!t || P.tokenOf)) return { state: 'unconfigured', label: P.tokenOf && t ? 'Enter the IDs below' : 'Not configured' }; if (!t) return { state: 'configured', label: P.tokenOf ? `Waiting for the ${PROVIDERS[P.tokenOf].name} sign in` : 'Configured, not connected' }; if (expired(t) && !t.refresh) return { state: 'expired', label: 'Token expired' }; const far = t.exp && t.exp > Date.now() + 5 * 365 * 864e5; return { state: 'connected', label: (P.tokenOf ? 'Uses the Google sign in' : t.pasted ? 'Token pasted' : t.long ? 'Connected, 60 day token' : 'Connected') + (t.exp && !far ? ' · expires ' + stamp(t.exp) : far ? ' · long lived token' : '') }; }
  const stamp = ms => { const d = new Date(ms); return (typeof dateOf === 'function' ? dateOf(d) : d.toDateString()) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
  async function requestHosts() { if (!RT || !RT.permissions) return false; try { return await RT.permissions.request({ origins: HOST_ORIGINS }); } catch (e) { return false; } }
  async function hostsGranted() { if (!RT || !RT.permissions) return null; try { return await RT.permissions.contains({ origins: ['https://googleads.googleapis.com/*', 'https://graph.facebook.com/*'] }); } catch (e) { return null; } }
  return { ENV, RT, KEY, HOST_ORIGINS, PROVIDERS, PORDER, IMPORTERS, VERS, MIN, get S() { return S; }, ready: () => readyP, isReady: () => ready, cfg, tok, status, setCfg, connect, refreshToken, pasteToken, disconnect, test, pull, importCSV, templateCSV, redirectUrl, rowsAll, byLine, bySource, byHour, observedGrid, byZip, byCounty, pacing, social, rates, applied, applyToModels, applyToDesk: applyToModels, revertModels, deskPlan, planBudget, clearAll, lineOf, lineName, chanOf, stageOf, geoOf, tparts, settings: () => S.settings, setSettings: p => { Object.assign(S.settings, p); return save('settings'); }, requestHosts, hostsGranted, range, base, ver, resolveVer, windows, localParts, stamp };
})();
globalThis.ACCT = ACCT;
